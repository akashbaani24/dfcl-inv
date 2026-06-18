import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const status = searchParams.get('status') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ bookings: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };
    if (status) where.status = status;

    const bookings = await db.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { itemName: true } },
        entity: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { entityId, itemId, customerId, bookingNo, quantity, amount, deliveryDate, status, notes } = body;

    if (!entityId) return NextResponse.json({ error: 'Entity is required' }, { status: 400 });

    // Generate booking number if not provided
    const autoBookingNo = bookingNo || `BK-${Date.now().toString().slice(-8)}`;

    const booking = await db.booking.create({
      data: {
        entityId,
        itemId: itemId || null,
        customerId: customerId || null,
        bookingNo: autoBookingNo,
        quantity: parseInt(quantity) || 1,
        amount: parseFloat(amount) || 0,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status: status || 'pending',
        notes: notes || null,
        createdBy: currentUser.id,
      },
      include: {
        item: { select: { itemName: true } },
        entity: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
