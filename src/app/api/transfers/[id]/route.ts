import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update transfer
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to modify items' }, { status: 403 });
    }

    const { id } = await params;
    const { itemId, fromEntityId, toEntityId, quantity, status, notes } = await request.json();

    // Get existing transfer
    const existing = await db.transfer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // If transitioning to "completed", handle stock changes
    const oldStatus = existing.status;
    const newStatus = status || oldStatus;

    if (oldStatus !== 'completed' && newStatus === 'completed') {
      const qty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
      const effectiveItemId = itemId || existing.itemId;
      const effectiveFromId = fromEntityId || existing.fromEntityId;
      const effectiveToId = toEntityId || existing.toEntityId;

      // Decrease stock at fromEntity
      const fromStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: effectiveItemId, entityId: effectiveFromId } },
      });
      const fromNewQty = (fromStock?.quantity || 0) - qty;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: effectiveItemId, entityId: effectiveFromId } },
        update: { quantity: fromNewQty },
        create: { itemId: effectiveItemId, entityId: effectiveFromId, quantity: fromNewQty },
      });

      // Increase stock at toEntity
      const toStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: effectiveItemId, entityId: effectiveToId } },
      });
      const toNewQty = (toStock?.quantity || 0) + qty;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: effectiveItemId, entityId: effectiveToId } },
        update: { quantity: toNewQty },
        create: { itemId: effectiveItemId, entityId: effectiveToId, quantity: toNewQty },
      });

      // Create a Receive entry
      await db.receive.create({
        data: {
          itemId: effectiveItemId,
          entityId: effectiveToId,
          quantity: qty,
          sourceEntityId: effectiveFromId,
          notes: `Auto-created from transfer ${id}`,
          createdBy: currentUser.id,
        },
      });
    }

    const transfer = await db.transfer.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(fromEntityId && { fromEntityId }),
        ...(toEntityId && { toEntityId }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(status && { status }),
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
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can delete' }, { status: 403 });
    }

    const { id } = await params;

    // Revert stock if transfer was completed
    const transfer = await db.transfer.findUnique({ where: { id } });
    if (transfer && transfer.status === 'completed') {
      const qty = transfer.quantity;

      // Increase stock back at fromEntity
      const fromStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: transfer.itemId, entityId: transfer.fromEntityId } },
      });
      const fromNewQty = (fromStock?.quantity || 0) + qty;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: transfer.itemId, entityId: transfer.fromEntityId } },
        update: { quantity: fromNewQty },
        create: { itemId: transfer.itemId, entityId: transfer.fromEntityId, quantity: fromNewQty },
      });

      // Decrease stock at toEntity
      const toStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: transfer.itemId, entityId: transfer.toEntityId } },
      });
      const toNewQty = (toStock?.quantity || 0) - qty;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: transfer.itemId, entityId: transfer.toEntityId } },
        update: { quantity: toNewQty },
        create: { itemId: transfer.itemId, entityId: transfer.toEntityId, quantity: toNewQty },
      });
    }

    await db.transfer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
