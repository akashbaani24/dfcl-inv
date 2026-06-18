import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all receives
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
      return NextResponse.json({ receives: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.entityId = entityId;
    } else if (userEntityIds) {
      where.entityId = { in: userEntityIds };
    }

    const receives = await db.receive.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        entity: true,
        sourceEntity: true,
      },
    });

    return NextResponse.json({ receives });
  } catch (error) {
    console.error('Get receives error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new receive
// If sourceEntityId is provided (i.e. receiving from another entity), this will:
//   1. Increment the receiving entity's stock (as before)
//   2. Decrement the source entity's stock (★ Requirement #3)
//   3. Mark any matching pending transfer as "completed" (★ Requirement #2 + #3)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to modify items' }, { status: 403 });
    }

    const { itemId, entityId, quantity, sourceEntityId, referenceNo, notes, transferId } = await request.json();

    if (!itemId || !entityId || !quantity) {
      return NextResponse.json(
        { error: 'Item, entity, and quantity are required' },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);

    // Use a transaction so all stock + transfer updates happen atomically
    const receive = await db.$transaction(async (tx) => {
      // 1. Create the Receive entry
      const r = await tx.receive.create({
        data: {
          itemId,
          entityId,
          quantity: qty,
          sourceEntityId: sourceEntityId || null,
          referenceNo: referenceNo || null,
          notes: notes || null,
          createdBy: currentUser.id,
        },
        include: {
          item: true,
          entity: true,
          sourceEntity: true,
        },
      });

      // 2. Increment receiving entity's stock
      const existingStock = await tx.stock.findUnique({
        where: { itemId_entityId: { itemId, entityId } },
      });
      const newQuantity = (existingStock?.quantity || 0) + qty;
      await tx.stock.upsert({
        where: { itemId_entityId: { itemId, entityId } },
        update: { quantity: newQuantity },
        create: { itemId, entityId, quantity: newQuantity },
      });

      // 3. If receiving from another entity → decrement source stock + complete matching transfer
      if (sourceEntityId && sourceEntityId !== entityId) {
        // Decrement source entity's stock
        const srcStock = await tx.stock.findUnique({
          where: { itemId_entityId: { itemId, entityId: sourceEntityId } },
        });
        const srcNewQty = (srcStock?.quantity || 0) - qty;
        await tx.stock.upsert({
          where: { itemId_entityId: { itemId, entityId: sourceEntityId } },
          update: { quantity: srcNewQty },
          create: { itemId, entityId: sourceEntityId, quantity: srcNewQty },
        });

        // Find matching pending transfer (either by explicit transferId, or by item+from+to)
        let transfer: any = null;
        if (transferId) {
          transfer = await tx.transfer.findUnique({ where: { id: transferId } });
        } else {
          // Find the oldest pending transfer matching itemId + fromEntityId + toEntityId
          transfer = await tx.transfer.findFirst({
            where: {
              itemId,
              fromEntityId: sourceEntityId,
              toEntityId: entityId,
              status: 'pending',
            },
            orderBy: { createdAt: 'asc' },
          });
        }

        if (transfer && transfer.status !== 'completed') {
          await tx.transfer.update({
            where: { id: transfer.id },
            data: {
              status: 'completed',
              notes: (transfer.notes ? transfer.notes + ' | ' : '') + `Received via ${r.id} on ${new Date().toISOString()}`,
            },
          });
        }
      }

      return r;
    });

    return NextResponse.json({ receive });
  } catch (error) {
    console.error('Create receive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
