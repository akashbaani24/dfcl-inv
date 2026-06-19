import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@libsql/client';

// POST /api/admin/backfill-barcodes
// One-time maintenance endpoint to backfill barcode/itemCode on existing items
// whose barcode/itemCode fields are empty.
//
// Strategy: for each item with empty barcode, check if its itemName looks like a
// barcode (all digits) or an item code (alphanumeric with dashes) and set the
// appropriate field. Uses batch SQL for speed (handles 22k+ items in seconds).
//
// Auth: admin only.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find all items where barcode is null/empty AND itemCode is null/empty
    // (only consider items that need both fields filled — skip items that already have one)
    const itemsNeedingBackfill = await db.item.findMany({
      where: {
        AND: [
          { OR: [{ barcode: null }, { barcode: '' }] },
          { OR: [{ itemCode: null }, { itemCode: '' }] },
        ],
      },
      select: { id: true, itemName: true, barcode: true, itemCode: true },
    });

    // Use direct libsql for batch updates (much faster than Prisma's per-row update)
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    let updated = 0;
    const sampleUpdates: Array<{ id: string; itemName: string; field: string; value: string }> = [];

    if (tursoUrl && tursoToken) {
      const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
      const stmts: Array<{ sql: string; args: (string)[] }> = [];

      for (const item of itemsNeedingBackfill) {
        const name = item.itemName.trim();
        let field: 'barcode' | 'itemCode' | null = null;

        // Heuristic 1: if itemName is all digits (and length >= 6), treat as barcode
        if (/^\d{6,}$/.test(name)) {
          field = 'barcode';
        }
        // Heuristic 2: if itemName has a dash and looks like an item code
        else if (/-/.test(name) && /^[A-Za-z0-9\-]+$/.test(name)) {
          field = 'itemCode';
        }

        if (field) {
          stmts.push({
            sql: `UPDATE "Item" SET "${field}" = ? WHERE "id" = ? AND ("${field}" IS NULL OR "${field}" = '')`,
            args: [name, item.id],
          });
          if (sampleUpdates.length < 50) {
            sampleUpdates.push({ id: item.id, itemName: name, field, value: name });
          }
        }
      }

      // Execute in batches of 100 statements
      const BATCH = 100;
      for (let i = 0; i < stmts.length; i += BATCH) {
        const batch = stmts.slice(i, i + BATCH);
        try {
          const results = await libsql.batch(batch, 'write');
          for (const r of results) {
            updated += r.rows_affected || 0;
          }
        } catch (e) {
          // Continue on batch error — we'll report partial success
          console.error('Batch update error:', String(e).slice(0, 200));
        }
      }
    } else {
      // Fallback: Prisma (for local dev without Turso)
      for (const item of itemsNeedingBackfill) {
        const name = item.itemName.trim();
        const data: { barcode?: string; itemCode?: string } = {};
        if (/^\d{6,}$/.test(name)) data.barcode = name;
        else if (/-/.test(name) && /^[A-Za-z0-9\-]+$/.test(name)) data.itemCode = name;
        if (Object.keys(data).length > 0) {
          try {
            await db.item.update({ where: { id: item.id }, data });
            updated++;
            if (sampleUpdates.length < 50) {
              sampleUpdates.push({ id: item.id, itemName: name, field: Object.keys(data)[0] as 'barcode' | 'itemCode', value: name });
            }
          } catch {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      scanned: itemsNeedingBackfill.length,
      updated,
      updates: sampleUpdates,
    });
  } catch (error) {
    console.error('Backfill barcodes error:', error);
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
