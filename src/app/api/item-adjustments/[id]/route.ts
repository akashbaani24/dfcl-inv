import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';

// PUT update item adjustment
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'itemAdjustment', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit adjustments' }, { status: 403 });
    }

    const { id } = await params;
    const { itemId, entityId, adjustmentType, quantity, reason } = await request.json();

    // Revert old adjustment's stock effect
    const oldAdjustment = await db.itemAdjustment.findUnique({ where: { id } });
    if (oldAdjustment) {
      const oldDelta = oldAdjustment.adjustmentType === 'increase' ? -oldAdjustment.quantity : oldAdjustment.quantity;
      const oldStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: oldAdjustment.itemId, entityId: oldAdjustment.entityId } },
      });
      const revertedQty = (oldStock?.quantity || 0) + oldDelta;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: oldAdjustment.itemId, entityId: oldAdjustment.entityId } },
        update: { quantity: revertedQty },
        create: { itemId: oldAdjustment.itemId, entityId: oldAdjustment.entityId, quantity: revertedQty },
      });
    }

    // Apply new adjustment's stock effect
    const newAdjustmentType = adjustmentType || oldAdjustment?.adjustmentType;
    const newQuantity = quantity !== undefined ? parseInt(quantity) : oldAdjustment?.quantity;
    const newItemId = itemId || oldAdjustment?.itemId;
    const newEntityId = entityId || oldAdjustment?.entityId;

    if (newAdjustmentType && newQuantity && newItemId && newEntityId) {
      const newDelta = newAdjustmentType === 'increase' ? newQuantity : -newQuantity;
      const currentStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
      });
      const updatedQty = (currentStock?.quantity || 0) + newDelta;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
        update: { quantity: updatedQty },
        create: { itemId: newItemId, entityId: newEntityId, quantity: updatedQty },
      });
    }

    const itemAdjustment = await db.itemAdjustment.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(entityId && { entityId }),
        ...(adjustmentType && { adjustmentType }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(reason && { reason }),
      },
      include: {
        item: true,
        entity: true,
      },
    });

    return NextResponse.json({ itemAdjustment });
  } catch (error) {
    console.error('Update item adjustment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE item adjustment
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

    // Revert the stock effect before deleting
    const adjustment = await db.itemAdjustment.findUnique({ where: { id } });
    if (adjustment) {
      const delta = adjustment.adjustmentType === 'increase' ? -adjustment.quantity : adjustment.quantity;
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: adjustment.itemId, entityId: adjustment.entityId } },
      });
      const newQty = (existingStock?.quantity || 0) + delta;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: adjustment.itemId, entityId: adjustment.entityId } },
        update: { quantity: newQty },
        create: { itemId: adjustment.itemId, entityId: adjustment.entityId, quantity: newQty },
      });
    }

    await db.itemAdjustment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete item adjustment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
