import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@libsql/client';

// POST /api/admin/backfill-barcodes
// One-time maintenance endpoint to backfill barcode/itemCode on existing items.
//
// Strategy: for each item with empty barcode, check if its itemName looks like a
// barcode (all digits) or an item code (alphanumeric with dashes) and set the
// appropriate field. Uses direct libsql batch for speed.
//
// Auth: admin only.
// Body: { limit?: number } — max items to scan in this call (default 5000)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    let body: any = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }
    const LIMIT = Math.min(body.limit || 5000, 5000);

    // Use direct libsql for everything — much faster than Prisma for bulk operations
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
      return NextResponse.json({ error: 'Turso not configured' }, { status: 500 });
    }

    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });

    // Find items needing backfill — direct SQL, limited
    const result = await libsql.execute({
      sql: `SELECT "id", "itemName" FROM "Item"
            WHERE ("barcode" IS NULL OR "barcode" = '')
              AND ("itemCode" IS NULL OR "itemCode" = '')
            LIMIT ?`,
      args: [LIMIT],
    });

    const items = result.rows as Array<{ id: string; itemName: string }>;

    // Build UPDATE statements
    const stmts: Array<{ sql: string; args: string[] }> = [];
    const sampleUpdates: Array<{ id: string; itemName: string; field: string; value: string }> = [];

    for (const item of items) {
      const name = (item.itemName || '').trim();
      if (!name) continue;
      let field: 'barcode' | 'itemCode' | null = null;

      // Heuristic 1: all digits, length >= 6 → barcode
      if (/^\d{6,}$/.test(name)) {
        field = 'barcode';
      }
      // Heuristic 2: has dash, alphanumeric → itemCode
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

    // Execute in batches of 50 statements (libsql batch limit safety)
    let updated = 0;
    const BATCH = 50;
    for (let i = 0; i < stmts.length; i += BATCH) {
      const batch = stmts.slice(i, i + BATCH);
      try {
        const results = await libsql.batch(batch, 'write');
        for (const r of results) {
          updated += (r as any).rows_affected || 0;
        }
      } catch (e) {
        console.error('Batch error at offset', i, ':', String(e).slice(0, 200));
      }
    }

    // Count remaining items needing backfill (for the user to know if they should run again)
    const remainingResult = await libsql.execute(
      `SELECT COUNT(*) as cnt FROM "Item"
       WHERE ("barcode" IS NULL OR "barcode" = '')
         AND ("itemCode" IS NULL OR "itemCode" = '')`
    );
    const remaining = (remainingResult.rows[0] as any)?.cnt || 0;

    return NextResponse.json({
      success: true,
      scanned: items.length,
      updated,
      remaining,
      hasMore: remaining > 0,
      message: remaining > 0
        ? `Backfilled ${updated} items. ${remaining} items still need backfill — call this endpoint again to process the next batch.`
        : `Backfilled ${updated} items. No more items need backfill.`,
      updates: sampleUpdates,
    });
  } catch (error) {
    console.error('Backfill barcodes error:', error);
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 });
  }
}
