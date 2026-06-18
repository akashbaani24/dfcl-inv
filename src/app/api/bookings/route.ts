import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Auto-cancel expired bookings (called when user opens Booking page)
async function autoCancelExpired() {
  try {
    const now = new Date()
    const result = await db.booking.updateMany({
      where: {
        tillDate: { lt: now },
        status: { notIn: ['delivered', 'cancelled'] },
      },
      data: { status: 'cancelled' },
    })
    return result.count
  } catch (e) {
    console.error('Auto-cancel error:', e)
    return 0
  }
}

// PUT with autoCancel flag — auto-cancels expired bookings
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    if (body.autoCancel) {
      const cancelled = await autoCancelExpired();
      return NextResponse.json({ success: true, cancelled });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Auto-cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ bookings: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };

    const bookings = await db.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        entity: { select: { name: true } },
        customer: { select: { name: true } },
        items: {
          include: {
            item: { select: { itemName: true } },
            fromEntity: { select: { name: true } },
          },
        },
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
    const { entityId, customerId, bookingDate, tillDate, status, reason, notes, items } = body;

    if (!entityId) return NextResponse.json({ error: 'Entity is required' }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Auto-generate booking number: BK-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    const bookingNo = `BK-${dateStr}-${randomStr}`;

    const booking = await db.booking.create({
      data: {
        bookingNo,
        entityId,
        customerId: customerId || null,
        bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
        tillDate: tillDate ? new Date(tillDate) : null,
        status: status || 'pending',
        reason: reason || null,
        notes: notes || null,
        createdBy: currentUser.id,
        items: {
          create: items.map((item: { itemId: string; fromEntityId: string; quantity: number }) => ({
            itemId: item.itemId,
            fromEntityId: item.fromEntityId,
            quantity: parseInt(String(item.quantity)) || 1,
          })),
        },
      },
      include: {
        entity: { select: { name: true } },
        customer: { select: { name: true } },
        items: {
          include: {
            item: { select: { itemName: true } },
            fromEntity: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
