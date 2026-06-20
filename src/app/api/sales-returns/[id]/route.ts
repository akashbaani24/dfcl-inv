import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';

// PUT update sales return
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'salesReturn', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit sales returns' }, { status: 403 });
    }

    const { id } = await params;
    const { itemId, entityId, customerId, salesOrderId, quantity, price, reason, status, notes } =
      await request.json();

    // Get existing return
    const existing = await db.salesReturn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sales return not found' }, { status: 404 });
    }

    // Revert old stock effect if it was approved
    if (existing.status === 'approved') {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: existing.itemId, entityId: existing.entityId } },
      });
      const revertedQty = (existingStock?.quantity || 0) - existing.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: existing.itemId, entityId: existing.entityId } },
        update: { quantity: revertedQty },
        create: { itemId: existing.itemId, entityId: existing.entityId, quantity: revertedQty },
      });
    }

    // Apply new stock effect if new status is approved
    const newStatus = status || existing.status;
    const newItemId = itemId || existing.itemId;
    const newEntityId = entityId || existing.entityId;
    const newQuantity = quantity !== undefined ? parseInt(quantity) : existing.quantity;

    if (newStatus === 'approved' && newItemId && newEntityId && newQuantity) {
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

    const salesReturn = await db.salesReturn.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(entityId && { entityId }),
        ...(customerId && { customerId }),
        ...(salesOrderId !== undefined && { salesOrderId: salesOrderId || null }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(reason && { reason }),
        ...(status && { status }),
      },
      include: {
        item: true,
        entity: true,
        customer: true,
        salesOrder: true,
      },
    });

    return NextResponse.json({ salesReturn });
  } catch (error) {
    console.error('Update sales return error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE sales return
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

    // Revert stock effect if it was approved
    const salesReturn = await db.salesReturn.findUnique({ where: { id } });
    if (salesReturn && salesReturn.status === 'approved') {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId: salesReturn.itemId, entityId: salesReturn.entityId } },
      });
      const newQty = (existingStock?.quantity || 0) - salesReturn.quantity;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId: salesReturn.itemId, entityId: salesReturn.entityId } },
        update: { quantity: newQty },
        create: { itemId: salesReturn.itemId, entityId: salesReturn.entityId, quantity: newQty },
      });
    }

    await db.salesReturn.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sales return error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
