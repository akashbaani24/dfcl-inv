import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';

// POST /api/admin/fix-exact-total?token=DFCL_RESCUE_2026
// Adds the missing Adhesive row (21/05/2026) that was misread from the image.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const results = { itemsAdded: 0, stockUpdated: 0, errors: [] as any[] };

  try {
    const entity = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

    // Missing row: Adhesive on 21/05/2026 — was misread as "Item: 14.40, Qty: kg"
    // Actual: Item: Adhesive, Qty: 14.40, Price: 416.67, Total: 6000.05
    const missingRows = [
      { date: '2026-05-21', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 14.40, unitPrice: 416.67 },
    ];

    for (const row of missingRows) {
      const item = await db.item.findUnique({ where: { itemName: row.itemName } });
      if (!item) { results.errors.push(`${row.itemName} not found`); continue; }
      const supplier = await db.supplier.findFirst({ where: { name: row.supplier } });

      const existingPurchase = await db.purchase.findFirst({
        where: {
          entityId: entity.id,
          supplierId: supplier?.id,
          purchaseDate: { gte: new Date(row.date + 'T00:00:00.000Z'), lte: new Date(row.date + 'T23:59:59.999Z') },
        },
        include: { items: true },
      });

      const qty = row.quantity;
      const total = qty * row.unitPrice;

      if (existingPurchase) {
        const alreadyHas = existingPurchase.items.some((pi: any) => pi.itemId === item.id);
        if (alreadyHas) { results.errors.push(`${row.itemName} already exists`); continue; }
        try {
          await db.purchaseItem.create({
            data: { purchaseId: existingPurchase.id, itemId: item.id, quantity: qty, unitPrice: row.unitPrice, uom: item.uom || 'KG', total, cogsPerUnit: 0, landedCostPerUnit: row.unitPrice },
          });
          results.itemsAdded++;
          try { await applyStockDelta(db, item.id, entity.id, qty); results.stockUpdated++; } catch (e: any) {}
        } catch (e: any) { results.errors.push({ item: row.itemName, error: e.message }); }
      } else {
        const purchaseNo = `PUR-FIX-${row.date.replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
        try {
          await db.purchase.create({
            data: {
              purchaseNo, purchaseDate: new Date(row.date), purchaseType: 'local',
              entityId: entity.id, supplierId: supplier?.id || null,
              status: 'approved', notes: `Fix — missing ${row.itemName}`,
              items: { create: [{ itemId: item.id, quantity: qty, unitPrice: row.unitPrice, uom: item.uom || 'KG', total, cogsPerUnit: 0, landedCostPerUnit: row.unitPrice }] },
            },
          });
          results.itemsAdded++;
          try { await applyStockDelta(db, item.id, entity.id, qty); results.stockUpdated++; } catch (e: any) {}
        } catch (e: any) { results.errors.push({ purchase: purchaseNo, error: e.message }); }
      }
    }

    const allPurchases = await db.purchase.findMany({ where: { entityId: entity.id }, include: { items: true } });
    const totalAfter = allPurchases.reduce((s, p) => s + p.items.reduce((ts: number, pi: any) => ts + pi.total, 0), 0);

    return NextResponse.json({
      success: true, results,
      totalPurchases: allPurchases.length,
      totalAmountAfter: totalAfter,
      targetAmount: 4527558,
      difference: 4527558 - totalAfter,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
