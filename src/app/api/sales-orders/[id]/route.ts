import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update sales order
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
    const {
      itemId,
      entityId,
      customerId,
      quantity,
      price,
      makingCharge,
      deliveryDate,
      status,
      notes,
    } = await request.json();

    // Revert old sales order's stock effect
    const oldOrder = await db.salesOrder.findUnique({ where: { id } });
    if (oldOrder) {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: oldOrder.itemId, entityId: oldOrder.entityId } },
      });
      const revertedQty = (existingStock?.quantity || 0) + oldOrder.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: oldOrder.itemId, entityId: oldOrder.entityId } },
        update: { quantity: revertedQty },
        create: { itemId: oldOrder.itemId, entityId: oldOrder.entityId, quantity: revertedQty },
      });
    }

    // Apply new sales order's stock effect
    const newItemId = itemId || oldOrder?.itemId;
    const newEntityId = entityId || oldOrder?.entityId;
    const newQuantity = quantity !== undefined ? parseInt(quantity) : oldOrder?.quantity;

    if (newItemId && newEntityId && newQuantity) {
      const currentStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
      });
      const updatedQty = (currentStock?.quantity || 0) - newQuantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: newItemId, entityId: newEntityId } },
        update: { quantity: updatedQty },
        create: { itemId: newItemId, entityId: newEntityId, quantity: updatedQty },
      });
    }

    const salesOrder = await db.salesOrder.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(entityId && { entityId }),
        ...(customerId && { customerId }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(makingCharge !== undefined && { makingCharge: parseFloat(makingCharge) }),
        ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
        ...(status && { status }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        item: true,
        entity: true,
        customer: true,
        returns: true,
      },
    });

    return NextResponse.json({ salesOrder });
  } catch (error) {
    console.error('Update sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE sales order
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
    const salesOrder = await db.salesOrder.findUnique({ where: { id } });
    if (salesOrder) {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: salesOrder.itemId, entityId: salesOrder.entityId } },
      });
      const newQty = (existingStock?.quantity || 0) + salesOrder.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: salesOrder.itemId, entityId: salesOrder.entityId } },
        update: { quantity: newQty },
        create: { itemId: salesOrder.itemId, entityId: salesOrder.entityId, quantity: newQty },
      });
    }

    await db.salesOrder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
