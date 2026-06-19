import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { decrementStock, StockGuardError, getStock } from '@/lib/stock-guard';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && userEntityIds.length === 0) return NextResponse.json({ salesOrders: [] });

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };

    const salesOrders = await db.salesOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        entity: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        salesPerson: { select: { name: true } },
        items: {
          select: {
            id: true,
            itemId: true,
            quantity: true,
            unitPrice: true,
            item: { select: { itemName: true } },
            // ★ Include making entries so tailor payment page can compute payable
            makingEntries: { select: { id: true, name: true, unitPrice: true, quantity: true } },
          },
        },
        payments: { select: { id: true, amount: true, paymentType: true, paymentMode: true, receiptNo: true, paymentDate: true, chequeNo: true, bankName: true } },
        // ★ Include tailor payments so the list page can show "fully paid" badges
        tailorPayments: { select: { id: true, amount: true, tailorId: true, paymentDate: true } },
      },
    });

    return NextResponse.json({ salesOrders });
  } catch (error) {
    console.error('Get sales orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { entityId, customerId, salesPersonId, discount, orderDate, deliveryDate, status, notes, items, payments } = body;

    if (!entityId) return NextResponse.json({ error: 'Entity is required' }, { status: 400 });
    if (!customerId) return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Auto-generate sales number: SO-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    const salesNo = `SO-${dateStr}-${randomStr}`;

    // ★ STOCK GUARD — pre-check all items BEFORE creating the order.
    // Aggregate quantities per (item, entity) so we detect insufficient stock
    // up front and return a clear error rather than creating a half-order.
    const aggregated = new Map<string, number>();
    for (const item of items as any[]) {
      const key = `${item.itemId}|${entityId}`;
      aggregated.set(key, (aggregated.get(key) || 0) + (parseInt(item.quantity) || 1));
    }
    for (const [key, totalQty] of aggregated.entries()) {
      const [itemId] = key.split('|');
      const current = await getStock(db, itemId, entityId);
      if (current < totalQty) {
        const itemRow = await db.item.findUnique({ where: { id: itemId }, select: { itemName: true } });
        return NextResponse.json(
          {
            error: `Insufficient stock for "${itemRow?.itemName || itemId}". Available: ${current}, requested: ${totalQty}. Stock cannot go below 0.`,
          },
          { status: 400 }
        );
      }
    }

    // Create sales order with items and making entries
    const salesOrder = await db.salesOrder.create({
      data: {
        salesNo,
        entityId,
        customerId,
        salesPersonId: salesPersonId || null,
        discount: parseFloat(discount) || 0,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status: status || 'pending',
        notes: notes || null,
        createdBy: currentUser.id,
        items: {
          create: items.map((item: any) => ({
            itemId: item.itemId,
            entityId,
            quantity: parseInt(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            makingEntries: {
              create: (item.makingEntries || []).map((me: any) => ({
                name: me.name || '',
                makingInfoId: me.makingInfoId || null,
                unitPrice: parseFloat(me.unitPrice) || 0,
                quantity: parseInt(me.quantity) || 1,
              })),
            },
          })),
        },
        payments: payments && Array.isArray(payments) ? {
          create: payments.map((p: any) => {
            const pNow = new Date();
            const pDateStr = pNow.getFullYear().toString() + String(pNow.getMonth() + 1).padStart(2, '0') + String(pNow.getDate()).padStart(2, '0');
            const pRandom = Math.floor(1000 + Math.random() * 9000).toString();
            return {
              receiptNo: `MR-${pDateStr}-${pRandom}`,
              amount: parseFloat(p.amount) || 0,
              paymentType: p.paymentType || 'cash',
              paymentMode: p.paymentMode || 'advance',
              paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
              chequeNo: p.chequeNo || null,
              bankName: p.bankName || null,
              notes: p.notes || null,
              createdBy: currentUser.id,
            };
          }),
        } : undefined,
      },
      include: {
        entity: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        items: { include: { item: { select: { itemName: true } }, makingEntries: true } },
        payments: true,
      },
    });

    // Reduce stock for each item — using stock guard (atomic + race-safe)
    for (const item of items) {
      try {
        await decrementStock(db, item.itemId, entityId, parseInt(item.quantity) || 1);
      } catch (e) {
        if (e instanceof StockGuardError) {
          // Rollback the sales order we just created (cascade will delete items/payments/etc.)
          await db.salesOrder.delete({ where: { id: salesOrder.id } }).catch(() => {});
          const itemRow = await db.item.findUnique({ where: { id: item.itemId }, select: { itemName: true } });
          return NextResponse.json(
            {
              error: `Insufficient stock for "${itemRow?.itemName || item.itemId}". Available: ${e.currentQty}, requested: ${Math.abs(e.attemptedDelta)}. Sales order not created.`,
            },
            { status: 400 }
          );
        }
        throw e;
      }
    }

    // ★ Auto-calculate incentives based on IncentiveFormula (multiple ranges + entity type)
    // For each item in this sales order:
    //   1. Find active formulas that include this item
    //   2. For each formula, find a range where sale unit price falls within [priceFrom, priceTo]
    //   3. Determine entity type (outlet → outletCommission; head_office/warehouse → headOfficeCommission)
    //   4. Create Incentive entry with commission = rate × quantity
    try {
      const entity = await db.entity.findUnique({ where: { id: entityId }, select: { name: true, entityType: true } });
      const entityType = entity?.entityType || 'outlet';
      const orderItemIds = items.map((it: any) => it.itemId);
      if (orderItemIds.length > 0) {
        // Find all active formula-items matching these item IDs, with formula + ranges
        const formulaItems = await db.incentiveFormulaItem.findMany({
          where: { itemId: { in: orderItemIds }, formula: { status: 'active' } },
          include: { formula: { include: { ranges: { orderBy: { priceFrom: 'asc' } } } } },
        });
        // Group by item → formulas
        const byItem = new Map<string, typeof formulaItems>();
        for (const fi of formulaItems) {
          const arr = byItem.get(fi.itemId) || [];
          arr.push(fi);
          byItem.set(fi.itemId, arr);
        }
        // For each item, find a matching range in any formula
        for (const item of items) {
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const quantity = parseInt(item.quantity) || 1;
          const fis = byItem.get(item.itemId) || [];
          // Sort formulas by createdAt asc, then find first matching range
          let matchedFormula: any = null;
          let matchedRange: any = null;
          for (const fi of fis.sort((a, b) => a.formula.createdAt.getTime() - b.formula.createdAt.getTime())) {
            const range = fi.formula.ranges.find((r: any) => unitPrice >= r.priceFrom && unitPrice <= r.priceTo);
            if (range) { matchedFormula = fi.formula; matchedRange = range; break; }
          }
          if (!matchedFormula || !matchedRange) continue;
          // Determine commission based on entity type
          const isOutlet = entityType === 'outlet';
          const commissionPerUnit = isOutlet ? matchedRange.outletCommission : matchedRange.headOfficeCommission;
          if (commissionPerUnit <= 0) continue;
          const totalCommission = commissionPerUnit * quantity;
          const soItem = salesOrder.items.find((si: any) => si.itemId === item.itemId);
          await db.incentive.create({
            data: {
              itemId: item.itemId,
              entityId,
              amount: totalCommission,
              type: 'formula',
              status: 'pending',
              notes: `Auto from ${salesOrder.salesNo} • Formula: ${matchedFormula.name} • Range ${matchedRange.priceFrom}-${matchedRange.priceTo} • Entity type: ${entityType} • Commission/unit: ${commissionPerUnit}`,
              formulaId: matchedFormula.id,
              salesOrderItemId: soItem?.id || null,
              units: quantity,
              saleUnitPrice: unitPrice,
              createdBy: currentUser.id,
            },
          });
        }
      }
    } catch (incError) {
      console.error('Incentive auto-calc error:', incError);
    }

    return NextResponse.json({ salesOrder });
  } catch (error) {
    console.error('Create sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
