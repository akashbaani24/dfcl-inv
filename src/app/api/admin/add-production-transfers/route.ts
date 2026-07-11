import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';

// POST /api/admin/add-production-transfers?token=DFCL_RESCUE_2026
// Body: { rows: [{ date, itemName, quantity, uom }] }
// Processes the given rows as transfers from M/S Anchor Enterprise → Production Dekhaba.

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const body = await request.json();
  const rows: Array<{ date: string; itemName: string; quantity: number; uom: string }> = body.rows || [];

  const results = { transfersCreated: 0, itemsProcessed: 0, itemsNotFound: [] as string[], stockUpdated: 0, errors: [] as any[] };

  try {
    const entityFrom = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entityFrom) return NextResponse.json({ error: 'M/S Anchor Enterprise not found' }, { status: 404 });
    let entityTo = await db.entity.findFirst({ where: { name: { contains: 'Production Dekhaba' } } });
    if (!entityTo) entityTo = await db.entity.create({ data: { name: 'Production Dekhaba', description: 'Production unit', entityType: 'factory' } });

    const allItems = await db.item.findMany({ select: { id: true, itemName: true } });
    const itemMap = new Map<string, string>();
    for (const item of allItems) itemMap.set(item.itemName.toLowerCase(), item.id);

    function findItemId(name: string): string | null {
      const variants = [name, name.replace(/Ribbond/g, 'Ribbon'), name.replace(/Cornner/g, 'Corner'), name.replace(/Ribbond/g, 'Ribbon').replace(/Cornner/g, 'Corner')];
      for (const v of variants) if (itemMap.has(v.toLowerCase())) return itemMap.get(v.toLowerCase())!;
      return null;
    }

    const batchId = `TB-PROD-${Date.now()}`;

    for (const row of rows) {
      const itemId = findItemId(row.itemName);
      if (!itemId) { if (!results.itemsNotFound.includes(row.itemName)) results.itemsNotFound.push(row.itemName); continue; }
      try {
        await db.transfer.create({
          data: { itemId, fromEntityId: entityFrom.id, toEntityId: entityTo.id, quantity: row.quantity, status: 'completed', batchId, notes: `Production — ${row.date}` },
        });
        results.transfersCreated++;
        results.itemsProcessed++;
        try { await applyStockDelta(db, itemId, entityFrom.id, -row.quantity); } catch {}
        try { await applyStockDelta(db, itemId, entityTo.id, row.quantity); results.stockUpdated++; } catch {}
      } catch (e: any) { results.errors.push({ item: row.itemName, error: e.message }); }
    }

    return NextResponse.json({ success: true, results, totalRows: rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
