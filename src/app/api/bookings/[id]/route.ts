import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { customerId, bookingDate, tillDate, status, reason, notes, items } = body;

    const data: Record<string, unknown> = {};
    if (customerId !== undefined) data.customerId = customerId || null;
    if (bookingDate !== undefined) data.bookingDate = bookingDate ? new Date(bookingDate) : new Date();
    if (tillDate !== undefined) data.tillDate = tillDate ? new Date(tillDate) : null;
    if (status !== undefined) data.status = status;
    if (reason !== undefined) data.reason = reason || null;
    if (notes !== undefined) data.notes = notes || null;

    // If items provided, replace all booking items
    if (items && Array.isArray(items)) {
      await db.bookingItem.deleteMany({ where: { bookingId: id } });
      if (items.length > 0) {
        await db.bookingItem.createMany({
          data: items.map((item: { itemId: string; fromEntityId: string; quantity: number }) => ({
            bookingId: id,
            itemId: item.itemId,
            fromEntityId: item.fromEntityId,
            quantity: parseInt(String(item.quantity)) || 1,
          })),
        });
      }
    }

    const booking = await db.booking.update({
      where: { id },
      data,
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
