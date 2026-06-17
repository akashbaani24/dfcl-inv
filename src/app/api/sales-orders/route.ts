import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all sales orders
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';

    // Get user's accessible entities - admin and manager see all
    const userEntityIds =
      currentUser.role === 'admin' || currentUser.role === 'manager'
        ? null
        : currentUser.entityAccess.map((ea) => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ salesOrders: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.entityId = entityId;
    } else if (userEntityIds) {
      where.entityId = { in: userEntityIds };
    }

    const salesOrders = await db.salesOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        entity: true,
        customer: true,
        returns: true,
      },
    });

    return NextResponse.json({ salesOrders });
  } catch (error) {
    console.error('Get sales orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new sales order
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to modify items' }, { status: 403 });
    }

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

    if (!itemId || !entityId || !customerId || !quantity || price === undefined) {
      return NextResponse.json(
        { error: 'Item, entity, customer, quantity, and price are required' },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);

    const salesOrder = await db.salesOrder.create({
      data: {
        itemId,
        entityId,
        customerId,
        quantity: qty,
        price: parseFloat(price),
        makingCharge: makingCharge !== undefined ? parseFloat(makingCharge) : 0,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status: status || 'pending',
        notes: notes || null,
        createdBy: currentUser.id,
      },
      include: {
        item: true,
        entity: true,
        customer: true,
        returns: true,
      },
    });

    // Reduce stock for that entity
    const existingStock = await db.stock.findUnique({
      where: { itemId_entityId: { itemId, entityId } },
    });
    const newQuantity = (existingStock?.quantity || 0) - qty;
    await db.stock.upsert({
      where: { itemId_entityId: { itemId, entityId } },
      update: { quantity: newQuantity },
      create: { itemId, entityId, quantity: newQuantity },
    });

    return NextResponse.json({ salesOrder });
  } catch (error) {
    console.error('Create sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
