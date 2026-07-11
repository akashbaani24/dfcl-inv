import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';

// POST /api/admin/add-missing-ribbon-purchases?token=DFCL_RESCUE_2026
type Row = { date: string; supplier: string; itemName: string; quantity: number; unitPrice: number };

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const ribbonRows: Row[] = [
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 514.27, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 336.38, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 323.44, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 316.97, unitPrice: 400 },
    { date: '2025-09-20', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 485.16, unitPrice: 400 },
    { date: '2025-10-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 161.72, unitPrice: 400 },
    { date: '2025-11-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 323.44, unitPrice: 400 },
    { date: '2025-11-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 161.72, unitPrice: 400 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 258.75, unitPrice: 400 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 113.20, unitPrice: 400 },
    { date: '2026-01-18', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 113.20, unitPrice: 400 },
    { date: '2026-01-18', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 64.69, unitPrice: 400 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 161.72, unitPrice: 400 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 504.56, unitPrice: 400 },
    { date: '2026-06-24', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 194.06, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 64.69, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 194.06, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 113.20, unitPrice: 400 },
  ];

  const results = { itemsAdded: 0, stockUpdated: 0, errors: [] as any[] };

  try {
    const entity = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

    for (const row of ribbonRows) {
      const item = await db.item.findUnique({ where: { itemName: row.itemName } });
      if (!item) { results.errors.push(`${row.itemName} not found`); continue; }
      const supplier = await db.supplier.findFirst({ where: { name: row.supplier } });
      const purchaseDate = new Date(row.date);

      // Find existing purchase for this date + supplier + entity
      const existingPurchase = await db.purchase.findFirst({
        where: {
          entityId: entity.id,
          supplierId: supplier?.id,
          purchaseDate: { gte: new Date(row.date + 'T00:00:00.000Z'), lte: new Date(row.date + 'T23:59:59.999Z') },
        },
        include: { items: true },
      });

      if (existingPurchase) {
        // Check if this Ribbon item is already in the purchase
        const alreadyHas = existingPurchase.items.some((pi: any) => pi.itemId === item.id);
        if (alreadyHas) continue; // Skip — already exists

        // Add the missing Ribbon item to the existing purchase
        const qty = row.quantity;
        const total = qty * row.unitPrice;
        try {
          await db.purchaseItem.create({
            data: { purchaseId: existingPurchase.id, itemId: item.id, quantity: qty, unitPrice: row.unitPrice, uom: item.uom || 'CFT', total, cogsPerUnit: 0, landedCostPerUnit: row.unitPrice },
          });
          results.itemsAdded++;
          try { await applyStockDelta(db, item.id, entity.id, qty); results.stockUpdated++; } catch (e: any) { results.errors.push(`Stock: ${e.message}`); }
        } catch (e: any) { results.errors.push({ item: row.itemName, error: e.message }); }
      } else {
        // Create a new purchase for this group
        const dateStrCompact = row.date.replace(/-/g, '');
        const purchaseNo = `PUR-RIB-${dateStrCompact}-${Math.floor(Math.random() * 10000)}`;
        const qty = row.quantity;
        const total = qty * row.unitPrice;
        try {
          await db.purchase.create({
            data: {
              purchaseNo, purchaseDate, purchaseType: 'local',
              entityId: entity.id, supplierId: supplier?.id || null,
              status: 'approved', notes: `Ribbon items — Supplier: ${row.supplier}`,
              items: { create: [{ itemId: item.id, quantity: qty, unitPrice: row.unitPrice, uom: item.uom || 'CFT', total, cogsPerUnit: 0, landedCostPerUnit: row.unitPrice }] },
            },
          });
          results.itemsAdded++;
          try { await applyStockDelta(db, item.id, entity.id, qty); results.stockUpdated++; } catch (e: any) { results.errors.push(`Stock: ${e.message}`); }
        } catch (e: any) { results.errors.push({ purchase: purchaseNo, error: e.message }); }
      }
    }

    // Recalculate total
    const allPurchases = await db.purchase.findMany({ where: { entityId: entity.id }, include: { items: true } });
    const totalAfter = allPurchases.reduce((s, p) => s + p.items.reduce((ts: number, pi: any) => ts + pi.total, 0), 0);

    return NextResponse.json({ success: true, results, totalPurchases: allPurchases.length, totalAmountAfter: totalAfter });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
