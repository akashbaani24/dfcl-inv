import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { decrementStock, StockGuardError } from '@/lib/stock-guard';

// POST /api/sales-orders/[id]/deliver
// Confirms delivery of a sales order — decrements stock for each delivered item.
//
// Body: {
//   items: [{ salesOrderItemId, itemId, quantity }],  // quantities actually delivered (may be partial)
//   deliveryPerson?: string,
//   deliveryNotes?: string,
// }
//
// Behavior:
//   1. Validates the sales order exists and belongs to the user's accessible entities.
//   2. For each delivered item, atomically decrements stock (with stock guard).
//   3. Updates the sales order's deliveryStatus to "delivered" (or "partial" if not all items delivered).
//   4. Sets the sales order status to "delivered" if all items are fully delivered.
//   5. Returns the updated sales order + per-item delivery results.
//
// If any item has insufficient stock, returns 400 with details and NO stock is changed
// (atomic — all or nothing per call).
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

    // Load the sales order with its items
    const salesOrder = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
        entity: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // ★ Pre-check: aggregate requested delivery quantities per item and verify stock
    // This prevents partial delivery if any item is insufficient.
    const aggregated = new Map<string, number>();
    for (const di of items as any[]) {
      const key = di.itemId;
      aggregated.set(key, (aggregated.get(key) || 0) + (parseInt(di.quantity) || 0));
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
            error: `Insufficient stock for "${itemRow?.itemName || itemId}". Available: ${currentQty}, requested for delivery: ${totalQty}. Delivery not processed — no stock was changed.`,
          },
          { status: 400 }
        );
      }
    }

    // ★ All stock is sufficient — now decrement stock for each delivered item
    const deliveryResults: Array<{ itemId: string; itemName: string; requested: number; delivered: number; ok: boolean; error?: string }> = [];
    for (const di of items as any[]) {
      const qty = parseInt(di.quantity) || 0;
      if (qty <= 0) continue;
      const soItem = salesOrder.items.find((si: any) => si.id === di.salesOrderItemId || si.itemId === di.itemId);
      try {
        await decrementStock(db, di.itemId, salesOrder.entityId, qty);
        deliveryResults.push({
          itemId: di.itemId,
          itemName: soItem?.item?.itemName || 'Unknown',
          requested: soItem?.quantity || 0,
          delivered: qty,
          ok: true,
        });
      } catch (e) {
        if (e instanceof StockGuardError) {
          deliveryResults.push({
            itemId: di.itemId,
            itemName: soItem?.item?.itemName || 'Unknown',
            requested: soItem?.quantity || 0,
            delivered: 0,
            ok: false,
            error: `Insufficient stock: available ${e.currentQty}, requested ${Math.abs(e.attemptedDelta)}`,
          });
        } else {
          throw e;
        }
      }
    }

    // ★ Determine if delivery is full or partial
    const allItemsDelivered = salesOrder.items.every((si: any) => {
      const delivered = deliveryResults
        .filter(r => r.itemId === si.itemId)
        .reduce((sum: number, r: any) => sum + r.delivered, 0);
      return delivered >= si.quantity;
    });
    const anyDelivered = deliveryResults.some(r => r.ok && r.delivered > 0);

    // ★ Update the sales order
    await db.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        deliveryStatus: allItemsDelivered ? 'delivered' : (anyDelivered ? 'partial' : 'pending'),
        deliveryPerson: deliveryPerson || salesOrder.deliveryPerson,
        deliveryNotes: deliveryNotes || salesOrder.deliveryNotes,
        status: allItemsDelivered ? 'delivered' : salesOrder.status,
      },
    });

    return NextResponse.json({
      success: true,
      salesOrder: { ...salesOrder, deliveryStatus: allItemsDelivered ? 'delivered' : 'partial' },
      deliveryResults,
      allItemsDelivered,
      anyDelivered,
    });
  } catch (error) {
    console.error('Deliver sales order error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
