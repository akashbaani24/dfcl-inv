import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// GET all sales returns
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
      return NextResponse.json({ salesReturns: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.entityId = entityId;
    } else if (userEntityIds) {
      where.entityId = { in: userEntityIds };
    }

    const salesReturns = await db.salesReturn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        entity: true,
        customer: true,
        salesOrder: true,
      },
    });

    return NextResponse.json({ salesReturns });
  } catch (error) {
    console.error('Get sales returns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new sales return
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'salesReturn', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create sales returns' }, { status: 403 });
    }

    const { itemId, entityId, customerId, salesOrderId, quantity, price, reason, status, notes } =
      await request.json();

    if (!itemId || !entityId || !customerId || !quantity || price === undefined || !reason) {
      return NextResponse.json(
        { error: 'Item, entity, customer, quantity, price, and reason are required' },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);
    const returnStatus = status || 'pending';

    const salesReturn = await db.salesReturn.create({
      data: {
        itemId,
        entityId,
        customerId,
        salesOrderId: salesOrderId || null,
        quantity: qty,
        price: parseFloat(price),
        reason,
        status: returnStatus,
        createdBy: currentUser.id,
      },
      include: {
        item: true,
        entity: true,
        customer: true,
        salesOrder: true,
      },
    });

    // When status is "approved", increase stock for the entity
    if (returnStatus === 'approved') {
      const existingStock = await db.stock.findUnique({
        where: { itemId_entityId: { itemId, entityId } },
      });
      const newQuantity = (existingStock?.quantity || 0) + qty;
      await db.stock.upsert({
        where: { itemId_entityId: { itemId, entityId } },
        update: { quantity: newQuantity },
        create: { itemId, entityId, quantity: newQuantity },
      });
    }

    return NextResponse.json({ salesReturn });
  } catch (error) {
    console.error('Create sales return error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
