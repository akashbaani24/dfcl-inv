import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { decrementStock, StockGuardError } from '@/lib/stock-guard';

// POST /api/sales-orders/[id]/deliver
// Creates a NEW Delivery record for the sales order. Each call = one delivery with its own
// delivery number (DL-YYYYMMDD-XXXX) and its own challan. Multiple deliveries can be created
// for the same sales order over time (partial deliveries).
//
// Stock is decremented atomically at creation time (with stock guard).
// Once created, a delivery cannot be modified by regular users (admin can reverse via DELETE).
//
// Body: {
//   items: [{ salesOrderItemId, itemId, quantity, uom }],  // quantities to deliver in THIS delivery
//   deliveryPerson?: string,
//   deliveryNotes?: string,
// }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id: salesOrderId } = await params;
    const body = await request.json();
    const { items, deliveryPerson, deliveryNotes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one delivered item is required' }, { status: 400 });
    }

    // Load the sales order with its items + existing deliveries (to compute already-delivered qty)
    const salesOrder = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: {
          include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } },
        },
        deliveries: {
          include: { items: { select: { salesOrderItemId: true, quantity: true } } },
        },
        entity: { select: { name: true } },
        customer: { select: { name: true, phone: true, address: true } },
      },
    });

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // ★ Compute already-delivered qty per sales order item
    const alreadyDelivered = new Map<string, number>();
    for (const d of salesOrder.deliveries) {
      for (const di of d.items) {
        alreadyDelivered.set(di.salesOrderItemId, (alreadyDelivered.get(di.salesOrderItemId) || 0) + di.quantity);
      }
    }

    // ★ Validate: each item's requested delivery qty + already-delivered must not exceed ordered qty
    for (const di of items as any[]) {
      const soItem = salesOrder.items.find((si: any) => si.id === di.salesOrderItemId);
      if (!soItem) {
        return NextResponse.json({ error: `Sales order item ${di.salesOrderItemId} not found` }, { status: 400 });
      }
      const requested = parseFloat(di.quantity) || 0;
      if (requested <= 0) {
        return NextResponse.json({ error: `Quantity must be greater than 0 for "${soItem.item?.itemName || 'item'}"` }, { status: 400 });
      }
      const already = alreadyDelivered.get(di.salesOrderItemId) || 0;
      if (already + requested > soItem.quantity) {
        return NextResponse.json(
          {
            error: `Cannot deliver ${requested} units of "${soItem.item?.itemName || 'item'}". Ordered: ${soItem.quantity}, already delivered: ${already}, remaining: ${soItem.quantity - already}.`,
          },
          { status: 400 }
        );
      }
    }

    // ★ Pre-check stock for all items (atomic — if any insufficient, NO stock changed)
    const aggregated = new Map<string, number>();
    for (const di of items as any[]) {
      const key = di.itemId;
      aggregated.set(key, (aggregated.get(key) || 0) + (parseFloat(di.quantity) || 0));
    }
    for (const [itemId, totalQty] of aggregated.entries()) {
      const current = await db.stock.findUnique({
        where: { itemId_entityId: { itemId, entityId: salesOrder.entityId } },
        select: { quantity: true },
      });
      const currentQty = current?.quantity ?? 0;
      if (currentQty < totalQty) {
        const itemRow = await db.item.findUnique({ where: { id: itemId }, select: { itemName: true } });
        return NextResponse.json(
          {
            error: `Insufficient stock for "${itemRow?.itemName || itemId}". Available: ${currentQty}, requested for this delivery: ${totalQty}. Delivery not created — no stock was changed.`,
          },
          { status: 400 }
        );
      }
    }

    // ★ Generate delivery number
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    const deliveryNo = `DL-${dateStr}-${random}`;

    // ★ Create the Delivery record + items in a transaction with stock decrement
    const delivery = await db.$transaction(async (tx) => {
      // Create delivery
      const d = await tx.delivery.create({
        data: {
          deliveryNo,
          salesOrderId,
          entityId: salesOrder.entityId,
          deliveryDate: new Date(),
          deliveryPerson: deliveryPerson || null,
          deliveryNotes: deliveryNotes || null,
          createdBy: currentUser.id,
          items: {
            create: (items as any[]).map(di => ({
              salesOrderItemId: di.salesOrderItemId,
              itemId: di.itemId,
              quantity: parseFloat(di.quantity) || 0,
              uom: di.uom || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Decrement stock for each delivered item (atomic with stock guard)
      // ★ v60-fix97: When an item has multiple barcodes at this entity (ItemBarcode rows),
      //   we decrement from those rows first (oldest first by createdAt), then from the
      //   aggregate Stock table. This keeps per-barcode tracking accurate so future
      //   scans of a specific barcode find the right qty.
      for (const di of items as any[]) {
        const qty = parseFloat(di.quantity) || 0;
        if (qty <= 0) continue;
        try {
          // ★ Step 1: Try to decrement from ItemBarcode rows at this entity.
          //   We fetch rows ordered by oldest first, decrement each until qty is exhausted.
          let remainingToDecrement = qty;
          try {
            const ibRows = await (tx as any).itemBarcode.findMany({
              where: { itemId: di.itemId, entityId: salesOrder.entityId, quantity: { gt: 0 } },
              orderBy: { id: 'asc' },  // ★ oldest first
              select: { id: true, barcode: true, quantity: true },
            });
            for (const ib of ibRows) {
              if (remainingToDecrement <= 0) break;
              const takeFromThis = Math.min(ib.quantity, remainingToDecrement);
              await (tx as any).itemBarcode.update({
                where: { id: ib.id },
                data: { quantity: { decrement: takeFromThis } },
              });
              remainingToDecrement -= takeFromThis;
            }
          } catch (e) {
            // ItemBarcode table may not exist — fall through to aggregate decrement
            console.error('ItemBarcode decrement failed:', e);
          }

          // ★ Step 2: Decrement the aggregate Stock table (always — this is the
          //   primary stock tracker that the stock-guard checks against).
          await decrementStock(tx, di.itemId, salesOrder.entityId, qty);
        } catch (e) {
          if (e instanceof StockGuardError) {
            throw new Error(`STOCK_GUARD:${di.itemId}:${e.currentQty}:${Math.abs(e.attemptedDelta)}`);
          }
          throw e;
        }
      }

      return d;
    }).catch((err) => {
      // Surface stock guard errors cleanly
      if (typeof err?.message === 'string' && err.message.startsWith('STOCK_GUARD:')) {
        const [, itemId, currentQty, attempted] = err.message.split(':');
        throw new Error(`STOCK_GUARD:${itemId}:${currentQty}:${attempted}`);
      }
      throw err;
    });

    // ★ Recompute delivery status on the sales order
    const allItems = salesOrder.items;
    const newAlreadyDelivered = new Map<string, number>();
    // Re-fetch deliveries (the new one is included)
    const refreshedDeliveries = await db.delivery.findMany({
      where: { salesOrderId },
      include: { items: { select: { salesOrderItemId: true, quantity: true } } },
    });
    for (const d of refreshedDeliveries) {
      for (const di of d.items) {
        newAlreadyDelivered.set(di.salesOrderItemId, (newAlreadyDelivered.get(di.salesOrderItemId) || 0) + di.quantity);
      }
    }
    const allItemsFullyDelivered = allItems.every((si: any) => {
      const delivered = newAlreadyDelivered.get(si.id) || 0;
      return delivered >= si.quantity;
    });

    // Update sales order delivery status (but NOT the main 'status' — that requires payment too)
    await db.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        deliveryStatus: allItemsFullyDelivered ? 'delivered' : 'partial',
        deliveryPerson: deliveryPerson || salesOrder.deliveryPerson,
        deliveryNotes: deliveryNotes || salesOrder.deliveryNotes,
      },
    });

    return NextResponse.json({
      success: true,
      delivery,
      deliveryNo,
      allItemsFullyDelivered,
      message: allItemsFullyDelivered
        ? `Delivery ${deliveryNo} created. All items fully delivered. Mark the order as complete once payment is cleared.`
        : `Delivery ${deliveryNo} created. Some items remain to be delivered.`,
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.startsWith('STOCK_GUARD:')) {
      const [, itemId, currentQty, attempted] = error.message.split(':');
      const itemRow = await db.item.findUnique({ where: { id: itemId }, select: { itemName: true } }).catch(() => null);
      return NextResponse.json(
        { error: `Insufficient stock for "${itemRow?.itemName || itemId}". Available: ${currentQty}, requested: ${attempted}. Delivery not created.` },
        { status: 400 }
      );
    }
    console.error('Deliver sales order error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}

// GET /api/sales-orders/[id]/deliver — list all deliveries for this sales order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id: salesOrderId } = await params;
    const deliveries = await db.delivery.findMany({
      where: { salesOrderId },
      orderBy: { deliveryDate: 'desc' },
      include: {
        items: {
          include: {
            // We don't have a direct relation to SalesOrderItem from DeliveryItem,
            // so we just include the raw fields.
          },
        },
      },
    });

    // Enrich with item names
    const itemIds = new Set<string>();
    for (const d of deliveries) for (const di of d.items) itemIds.add(di.itemId);
    const items = await db.item.findMany({
      where: { id: { in: Array.from(itemIds) } },
      select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true },
    });
    const itemMap = new Map(items.map(i => [i.id, i]));
    for (const d of deliveries) {
      for (const di of d.items) {
        const it = itemMap.get(di.itemId);
        (di as any).item = it;
      }
    }

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('List deliveries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
