import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update receive
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
    const { itemId, entityId, quantity, sourceEntityId, referenceNo, notes } = await request.json();

    // Revert old receive's stock effect
    const oldReceive = await db.receive.findUnique({ where: { id } });
    if (oldReceive) {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: oldReceive.itemId, entityId: oldReceive.entityId } },
      });
      const revertedQty = (existingStock?.quantity || 0) - oldReceive.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: oldReceive.itemId, entityId: oldReceive.entityId } },
        update: { quantity: revertedQty },
        create: { itemId: oldReceive.itemId, entityId: oldReceive.entityId, quantity: revertedQty },
      });
    }

    // Apply new receive's stock effect
    const newItemId = itemId || oldReceive?.itemId;
    const newEntityId = entityId || oldReceive?.entityId;
    const newQuantity = quantity !== undefined ? parseInt(quantity) : oldReceive?.quantity;

    if (newItemId && newEntityId && newQuantity) {
      const currentStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
      });
      const updatedQty = (currentStock?.quantity || 0) + newQuantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
        update: { quantity: updatedQty },
        create: { itemId: newItemId, entityId: newEntityId, quantity: updatedQty },
      });
    }

    const receive = await db.receive.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(entityId && { entityId }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(sourceEntityId !== undefined && { sourceEntityId: sourceEntityId || null }),
        ...(referenceNo !== undefined && { referenceNo: referenceNo || null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        item: true,
        entity: true,
        sourceEntity: true,
      },
    });

    return NextResponse.json({ receive });
  } catch (error) {
    console.error('Update receive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE receive
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

    // Revert stock effect before deleting
    const receive = await db.receive.findUnique({ where: { id } });
    if (receive) {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: receive.itemId, entityId: receive.entityId } },
      });
      const newQty = (existingStock?.quantity || 0) - receive.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: receive.itemId, entityId: receive.entityId } },
        update: { quantity: newQty },
        create: { itemId: receive.itemId, entityId: receive.entityId, quantity: newQty },
      });
    }

    await db.receive.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete receive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
