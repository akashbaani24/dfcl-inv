import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// PUT update transfer
// Note: transfers are completed automatically when the destination entity creates a Receive
// (see /api/receives POST). Manual status changes here do NOT touch stock directly —
// if you want to "force-complete" a transfer, you must also create a Receive for it.
// This PUT only updates the metadata (notes, etc.) — status is read-only here.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'transfer', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit transfers' }, { status: 403 });
    }

    const { id } = await params;
    const { notes } = await request.json();

    const existing = await db.transfer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    const transfer = await db.transfer.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        item: true,
        fromEntity: true,
        toEntity: true,
      },
    });

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('Update transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE transfer
// Transfers created via POST never touch stock (stock only moves on Receive).
// So deleting any transfer — pending or completed — never needs to revert stock.
// If a Receive was created and stock was moved, that Receive record is the source
// of truth; deleting the transfer here doesn't undo the receive.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && !canMenu(currentUser, 'transfer', 'delete')) {
      return NextResponse.json({ error: 'Only admins, managers, or users with delete permission can delete' }, { status: 403 });
    }

    const { id } = await params;
    await db.transfer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
