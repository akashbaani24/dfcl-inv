import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/admin/backfill-barcodes
// One-time maintenance endpoint to backfill barcode/itemCode on existing items
// whose barcode/itemCode fields are empty.
//
// Strategy: for each item with empty barcode, check if its itemName looks like a
// barcode (all digits) or an item code (alphanumeric with dashes) and set the
// appropriate field. This is a best-effort heuristic — the user can also use
// /api/items/update-barcodes for explicit CSV-based updates.
//
// Auth: admin only.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find all items where barcode is null or empty
    const itemsNeedingBackfill = await db.item.findMany({
      where: {
        OR: [
          { barcode: null },
          { barcode: '' },
          { itemCode: null },
          { itemCode: '' },
        ],
      },
      select: { id: true, itemName: true, barcode: true, itemCode: true },
    });

    let updated = 0;
    const updates: Array<{ id: string; itemName: string; field: string; value: string }> = [];

    for (const item of itemsNeedingBackfill) {
      const name = item.itemName.trim();
      const data: { barcode?: string; itemCode?: string } = {};

      // Heuristic 1: if itemName is all digits (and length >= 6), treat it as a barcode
      if ((!item.barcode || item.barcode === '') && /^\d{6,}$/.test(name)) {
        data.barcode = name;
        updates.push({ id: item.id, itemName: name, field: 'barcode', value: name });
      }
      // Heuristic 2: if itemName has a dash and looks like an item code (e.g. "AJ-435-40-A")
      // and itemCode is empty, set itemCode = itemName
      else if ((!item.itemCode || item.itemCode === '') && /-/.test(name) && /^[A-Za-z0-9\-]+$/.test(name)) {
        data.itemCode = name;
        updates.push({ id: item.id, itemName: name, field: 'itemCode', value: name });
      }

      if (Object.keys(data).length > 0) {
        try {
          await db.item.update({ where: { id: item.id }, data });
          updated++;
        } catch (e) {
          // skip on error
        }
      }
    }

    return NextResponse.json({
      success: true,
      scanned: itemsNeedingBackfill.length,
      updated,
      updates: updates.slice(0, 50), // first 50 for display
    });
  } catch (error) {
    console.error('Backfill barcodes error:', error);
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
