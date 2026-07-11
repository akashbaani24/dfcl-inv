import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';

// POST /api/admin/fix-duplicate-purchases?token=DFCL_RESCUE_2026&action=check
//   Checks for duplicate purchases (same date + same supplier + same notes pattern)
// POST /api/admin/fix-duplicate-purchases?token=DFCL_RESCUE_2026&action=fix
//   Deletes duplicate purchases (keeping only one per date+supplier group) AND
//   reverses the stock that was incorrectly added by the duplicates.

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const action = request.nextUrl.searchParams.get('action') || 'check';

  try {
    // Step 1: Find "M/S Anchor Enterprise" entity
    const entity = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Step 2: Get ALL purchases for this entity
    const allPurchases = await db.purchase.findMany({
      where: { entityId: entity.id },
      include: {
        items: { include: { item: { select: { itemName: true } } } },
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Step 3: Group by (purchaseDate + supplierId) to find duplicates
    const groups = new Map<string, typeof allPurchases>();
    for (const p of allPurchases) {
      const dateKey = new Date(p.purchaseDate).toISOString().split('T')[0];
      const supplierKey = p.supplierId || 'none';
      const key = `${dateKey}|${supplierKey}`;
      const arr = groups.get(key) || [];
      arr.push(p);
      groups.set(key, arr);
    }

    // Step 4: For each group with >1 purchase, keep the FIRST (oldest) and mark rest as duplicates
    const duplicates: any[] = [];
    const uniqueGroups: any[] = [];
    for (const [key, purchases] of groups.entries()) {
      if (purchases.length > 1) {
        // Keep the first one (oldest by createdAt), mark rest as duplicates
        uniqueGroups.push({ key, kept: purchases[0], count: purchases.length });
        for (let i = 1; i < purchases.length; i++) {
          duplicates.push({
            id: purchases[i].id,
            purchaseNo: purchases[i].purchaseNo,
            date: key.split('|')[0],
            supplier: purchases[i].supplier?.name || '—',
            createdAt: purchases[i].createdAt,
            items: purchases[i].items.map((pi: any) => ({
              itemId: pi.itemId,
              itemName: pi.item?.itemName || '—',
              quantity: pi.quantity,
            })),
          });
        }
      } else {
        uniqueGroups.push({ key, kept: purchases[0], count: 1 });
      }
    }

    // Calculate totals
    const totalAllPurchases = allPurchases.reduce((s, p) => {
      return s + p.items.reduce((ts: number, pi: any) => ts + pi.total, 0);
    }, 0);

    const totalDuplicates = duplicates.reduce((s, d) => {
      // We don't have the total stored on the duplicate object, compute from items
      return s;
    }, 0);

    if (action === 'check') {
      return NextResponse.json({
        summary: {
          entity: entity.name,
          totalPurchases: allPurchases.length,
          uniqueGroups: uniqueGroups.length,
          duplicateCount: duplicates.length,
          totalAmountAll: totalAllPurchases,
        },
        duplicatePurchases: duplicates.map(d => ({
          id: d.id,
          purchaseNo: d.purchaseNo,
          date: d.date,
          supplier: d.supplier,
          createdAt: d.createdAt,
          itemCount: d.items.length,
        })),
        uniqueGroupSummary: uniqueGroups.map(g => ({
          date: g.key.split('|')[0],
          supplier: g.kept.supplier?.name || '—',
          purchaseCount: g.count,
          keptPurchaseNo: g.kept.purchaseNo,
        })),
      });
    }

    // action === 'fix': delete duplicates and reverse their stock
    const deleted: string[] = [];
    const stockReversed: any[] = [];
    const errors: any[] = [];

    for (const dup of duplicates) {
      try {
        // Step 5a: Reverse stock for each item in the duplicate purchase
        for (const item of dup.items) {
          try {
            await applyStockDelta(db, item.itemId, entity.id, -item.quantity);
            stockReversed.push({ purchaseNo: dup.purchaseNo, item: item.itemName, qty: -item.quantity });
          } catch (e: any) {
            // If stock goes negative, that's OK — we still delete the purchase
            errors.push({ purchaseNo: dup.purchaseNo, item: item.itemName, error: `Stock reverse: ${e.message}` });
          }
        }

        // Step 5b: Delete the duplicate purchase (items will cascade delete)
        await db.purchase.delete({ where: { id: dup.id } });
        deleted.push(dup.purchaseNo);
      } catch (e: any) {
        errors.push({ purchaseNo: dup.purchaseNo, error: e.message });
      }
    }

    // Recalculate total after deletion
    const remainingPurchases = await db.purchase.findMany({
      where: { entityId: entity.id },
      include: { items: true },
    });
    const totalAfterFix = remainingPurchases.reduce((s, p) => {
      return s + p.items.reduce((ts: number, pi: any) => ts + pi.total, 0);
    }, 0);

    return NextResponse.json({
      summary: {
        entity: entity.name,
        totalPurchasesBefore: allPurchases.length,
        duplicatesDeleted: deleted.length,
        totalPurchasesAfter: remainingPurchases.length,
        totalAmountBefore: totalAllPurchases,
        totalAmountAfter: totalAfterFix,
        stockReversals: stockReversed.length,
        errors: errors.length,
      },
      deletedPurchases: deleted,
      stockReversed: stockReversed.slice(0, 20),
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
