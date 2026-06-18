import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { itemId, customerId, bookingNo, quantity, amount, deliveryDate, status, notes } = body;

    const data: Record<string, unknown> = {};
    if (itemId !== undefined) data.itemId = itemId || null;
    if (customerId !== undefined) data.customerId = customerId || null;
    if (bookingNo !== undefined) data.bookingNo = bookingNo;
    if (quantity !== undefined) data.quantity = parseInt(quantity);
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const booking = await db.booking.update({
      where: { id },
      data,
      include: {
        item: { select: { itemName: true } },
        entity: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await db.booking.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
