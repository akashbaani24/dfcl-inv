import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';
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

    const { itemId, barcode, entityId, quantity, sourceEntityId, referenceNo, notes, transferId } = await request.json();

    if (!itemId || !entityId || !quantity) {
      return NextResponse.json(
        { error: 'Item, entity, and quantity are required' },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);

    // ★ If barcode is provided, validate it belongs to this item
    if (barcode) {
      const itemRow = await db.item.findUnique({
        where: { id: itemId },
        select: { barcode: true, itemName: true },
      });
      if (!itemRow) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      if (itemRow.barcode !== barcode) {
        const itemBarcodeRow = await (db as any).itemBarcode.findFirst({
          where: { barcode, itemId },
          select: { id: true },
        });
        if (!itemBarcodeRow) {
          return NextResponse.json(
            { error: `Barcode "${barcode}" does not belong to item "${itemRow.itemName}".` },
            { status: 400 }
          );
        }
      }
    }

    // Use a transaction so all stock + transfer updates happen atomically
    const receive = await db.$transaction(async (tx) => {
      // 1. Create the Receive entry (with barcode if provided)
      const r = await tx.receive.create({
        data: {
          itemId,
          barcode: barcode || null,
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
      //    This updates the generic Stock table (aggregate per item+entity)
      await applyStockDelta(tx, itemId, entityId, qty);

      // ★ 2b. If a specific barcode was provided, also track the qty on ItemBarcode
      //      so that future scans of this exact barcode at this entity find the qty.
      if (barcode) {
        try {
          // upsert by (barcode, entityId) — itemId is the parent
          await (tx as any).itemBarcode.upsert({
            where: { barcode_entityId: { barcode, entityId } },
            update: { quantity: { increment: qty } },
            create: { itemId, barcode, entityId, quantity: qty },
          });
        } catch (e) {
          // Non-fatal — ItemBarcode tracking is best-effort
          console.error('ItemBarcode receive increment error:', e);
        }
      }

      // ★ v59: Auto-create barcode on the item if it doesn't have one.
      // Generate a unique barcode based on the item's ID + timestamp.
      try {
        const item = await tx.item.findUnique({
          where: { id: itemId },
          select: { barcode: true, itemName: true },
        });
        if (item && (!item.barcode || item.barcode.trim() === '')) {
          // ★ v60-fix122: YYMMDD + 7 digits format
          const now = new Date();
          const yy = String(now.getFullYear()).slice(-2);
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const rand = Math.floor(1000000 + Math.random() * 9000000);
          const newBarcode = `${yy}${mm}${dd}${rand}`;
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

        // ★ 3b. If a specific barcode was provided, also decrement the source entity's
        //      ItemBarcode row for that barcode (best-effort, non-fatal).
        if (barcode) {
          try {
            await (tx as any).itemBarcode.updateMany({
              where: { barcode, entityId: sourceEntityId },
              data: { quantity: { decrement: qty } },
            });
          } catch (e) {
            console.error('ItemBarcode source decrement error:', e);
          }
        }

        // Find matching pending transfer (either by explicit transferId, or by item+from+to)
        let transfer: any = null;
        if (transferId) {
          transfer = await tx.transfer.findUnique({ where: { id: transferId } });
        } else {
          // Find the oldest pending transfer matching itemId + fromEntityId + toEntityId
          // ★ If barcode is provided, prefer transfers with matching barcode first
          if (barcode) {
            transfer = await tx.transfer.findFirst({
              where: {
                itemId,
                barcode,
                fromEntityId: sourceEntityId,
                toEntityId: entityId,
                status: 'pending',
              },
              orderBy: { createdAt: 'asc' },
            });
          }
          if (!transfer) {
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
