import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';
import { applyStockDelta, StockGuardError } from '@/lib/stock-guard';

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

    if (!canMenu(currentUser, 'receive', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create receives' }, { status: 403 });
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

      // 2. Increment receiving entity's stock (always safe — never goes negative)
      await applyStockDelta(tx, itemId, entityId, qty);

      // ★ v59: Auto-create barcode on the item if it doesn't have one.
      // Generate a unique barcode based on the item's ID + timestamp.
      try {
        const item = await tx.item.findUnique({
          where: { id: itemId },
          select: { barcode: true, itemName: true },
        });
        if (item && (!item.barcode || item.barcode.trim() === '')) {
          // Generate barcode: BC-<timestamp>-<random 4 digits>
          const ts = Date.now().toString().slice(-10);
          const rand = Math.floor(1000 + Math.random() * 9000);
          const newBarcode = `BC${ts}${rand}`;
          await tx.item.update({
            where: { id: itemId },
            data: { barcode: newBarcode },
          });
        }
      } catch (e) {
        // Non-fatal — barcode creation failure shouldn't block the receive
        console.error('Auto-barcode creation error:', e);
      }

      // 3. If receiving from another entity → decrement source stock (with guard)
      //    + complete matching transfer
      if (sourceEntityId && sourceEntityId !== entityId) {
        // Decrement source entity's stock — throws StockGuardError if insufficient
        try {
          await applyStockDelta(tx, itemId, sourceEntityId, -qty);
        } catch (e) {
          if (e instanceof StockGuardError) {
            throw new Error(
              `INSUFFICIENT_SOURCE_STOCK: Source entity has ${e.currentQty} units of this item, ` +
              `but you are trying to receive ${qty} from it. ` +
              `Transfer not allowed — stock would go below 0.`
            );
          }
          throw e;
        }

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
  } catch (error: any) {
    // Surface our custom INSUFFICIENT_SOURCE_STOCK error as a 400 (not 500)
    if (error?.message?.startsWith('INSUFFICIENT_SOURCE_STOCK:')) {
      return NextResponse.json({ error: error.message.replace('INSUFFICIENT_SOURCE_STOCK: ', '') }, { status: 400 });
    }
    console.error('Create receive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
