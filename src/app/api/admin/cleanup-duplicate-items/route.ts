import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// POST /api/admin/cleanup-duplicate-items?token=DFCL_RESCUE_2026&mode=dry-run
// POST /api/admin/cleanup-duplicate-items?token=DFCL_RESCUE_2026&mode=execute
//
// Cleans up the 132 duplicate items created by the buggy DEWS upload script.
// Pattern: items like "720-500-A 39", "720-500-A 38", etc. all share the same
// itemCode "720-500-A" — they should all be MERGED into one canonical item
// ("720-500-A") with their stock + barcodes consolidated.
//
// Algorithm:
//   1. Find all items where itemName matches the pattern "{base} {number}" OR
//      "{base}{number}" (where base ends with a letter and number is digits).
//   2. Group them by their itemCode (which is the "true" base name).
//   3. For each group:
//      - Pick a canonical item: prefer one whose itemName == itemCode (no suffix).
//        If none exists, pick the oldest one and rename it to the base name.
//      - For every non-canonical item in the group:
//        * Move all Stock rows from the duplicate's itemId to the canonical's itemId
//          (using SUM-then-DELETE to avoid unique constraint violations).
//        * Move all ItemBarcode rows similarly.
//        * Re-parent any BookingItem / SalesOrderItem / DeliveryItem /
//          PurchaseItem / ItemAdjustment / Transfer / Receive / Incentive rows.
//        * Delete the duplicate Item row.
//   4. Update canonical item's itemName to the base name (itemCode) — strip
//      any " 39" or "28" suffix.
//
// mode=dry-run: returns a preview of what would happen — NO changes.
// mode=execute: performs the cleanup. Returns before/after counts.

const HARDCODED_RESCUE_TOKEN = 'DFCL_RESCUE_2026';

interface DupItem {
  id: string;
  itemName: string;
  itemCode: string | null;
  barcode: string | null;
  createdAt: string;
}

interface Group {
  baseName: string;       // = itemCode (the canonical name)
  canonical: DupItem;     // chosen survivor
  duplicates: DupItem[];  // to be merged into canonical, then deleted
  totalStock: number;     // sum of stock across the group
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
  }
  const mode = request.nextUrl.searchParams.get('mode') === 'execute' ? 'execute' : 'dry-run';

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    return NextResponse.json({ error: 'Turso not configured' }, { status: 500 });
  }
  const client = createClient({ url: tursoUrl, authToken: tursoToken });

  const log: string[] = [];
  const groups: Group[] = [];

  try {
    // ============================================================
    // STEP 1: Find candidate duplicate items.
    // ============================================================
    // Match items where itemName either:
    //   - ends with " <digits>"  (e.g. "720-500-A 39")
    //   - ends with "<letter><digits>" where itemCode is the prefix
    //     (e.g. itemName="720-500-A39", itemCode="720-500-A")
    //
    // We'll fetch a generous candidate set, then group by itemCode.
    log.push(`Mode: ${mode}`);
    log.push(`Step 1: Fetching candidate duplicate items...`);

    // Fetch items that have an itemCode AND itemName contains the itemCode as a prefix
    // but itemName != itemCode (i.e. there's some extra suffix).
    // We can't easily do regex in SQLite, so fetch everything that has itemCode
    // and filter in JS. For 22k items this is ~1MB of data — acceptable.
    const r1 = await client.execute(
      `SELECT id, itemName, itemCode, barcode, createdAt
       FROM Item
       WHERE itemCode IS NOT NULL AND itemCode != '' AND itemName != itemCode
       ORDER BY itemCode ASC, createdAt ASC`
    );
    log.push(`  Found ${r1.rows.length} items where itemName != itemCode (candidates)`);

    // Group by itemCode
    const byItemCode = new Map<string, DupItem[]>();
    for (const row of r1.rows as any[]) {
      const ic = row.itemCode as string;
      if (!ic) continue;
      // Only consider this a duplicate if itemName starts with itemCode followed
      // by either a space + digits OR just digits (no other text).
      const itemName = row.itemName as string;
      const isDupe =
        itemName === ic + ' ' + (itemName.substring(ic.length + 1)) && /^\d+$/.test(itemName.substring(ic.length + 1))
        || itemName.startsWith(ic) && /^\d+$/.test(itemName.substring(ic.length)) && itemName.length > ic.length;
      if (!isDupe) continue;

      if (!byItemCode.has(ic)) byItemCode.set(ic, []);
      byItemCode.get(ic)!.push({
        id: row.id,
        itemName,
        itemCode: ic,
        barcode: row.barcode,
        createdAt: row.createdAt,
      });
    }

    log.push(`  After filtering by pattern: ${byItemCode.size} distinct itemCodes have duplicates`);

    // ============================================================
    // STEP 2: For each group, find/choose the canonical item.
    // ============================================================
    // The canonical item is:
    //   (a) An item where itemName == itemCode (the "clean" version that was
    //       created correctly the first time), OR
    //   (b) If no clean version exists, the oldest duplicate (we'll rename it).
    log.push(`Step 2: Building merge plan...`);
    for (const [itemCode, items] of byItemCode.entries()) {
      // Look for a clean version (itemName == itemCode)
      const r = await client.execute({
        sql: `SELECT id, itemName, itemCode, barcode, createdAt FROM Item WHERE itemCode = ? AND itemName = ? LIMIT 1`,
        args: [itemCode, itemCode],
      });
      let canonical: DupItem;
      if (r.rows.length > 0) {
        const c = r.rows[0] as any;
        canonical = {
          id: c.id, itemName: c.itemName, itemCode: c.itemCode,
          barcode: c.barcode, createdAt: c.createdAt,
        };
      } else {
        // No clean version — pick the oldest duplicate, we'll rename it later
        canonical = items[0]; // items is already sorted by createdAt ASC
      }
      const duplicates = items.filter(it => it.id !== canonical.id);

      // Sum stock across the group
      const allIds = [canonical.id, ...duplicates.map(d => d.id)];
      const placeholders = allIds.map(() => '?').join(',');
      const r2 = await client.execute({
        sql: `SELECT COALESCE(SUM(quantity), 0) as total FROM Stock WHERE itemId IN (${placeholders})`,
        args: allIds,
      });
      const totalStock = (r2.rows[0] as any).total;

      groups.push({
        baseName: itemCode,
        canonical,
        duplicates,
        totalStock,
      });
    }

    log.push(`  Total groups (distinct itemCodes with duplicates): ${groups.length}`);
    log.push(`  Total duplicate items to delete: ${groups.reduce((s, g) => s + g.duplicates.length, 0)}`);
    log.push(`  Total stock to consolidate: ${groups.reduce((s, g) => s + g.totalStock, 0)}`);

    // ============================================================
    // STEP 3: Preview / Execute
    // ============================================================
    if (mode === 'dry-run') {
      const preview = groups.slice(0, 30).map(g => ({
        baseName: g.baseName,
        canonical: { id: g.canonical.id, itemName: g.canonical.itemName, barcode: g.canonical.barcode },
        duplicateCount: g.duplicates.length,
        duplicateSamples: g.duplicates.slice(0, 5).map(d => ({ itemName: d.itemName, barcode: d.barcode })),
        totalStockAfterMerge: g.totalStock,
      }));
      return NextResponse.json({
        mode: 'dry-run',
        message: 'No changes made. Re-run with mode=execute to perform cleanup.',
        summary: {
          totalGroups: groups.length,
          totalDuplicatesToDelete: groups.reduce((s, g) => s + g.duplicates.length, 0),
          totalStockToConsolidate: groups.reduce((s, g) => s + g.totalStock, 0),
        },
        preview,
        log,
      });
    }

    // ===== EXECUTE MODE =====
    log.push(`Step 3: Executing cleanup...`);
    let deleted = 0;
    let stockMoved = 0;
    let barcodesMoved = 0;
    let renamed = 0;
    const errors: string[] = [];

    for (const g of groups) {
      const canonicalId = g.canonical.id;

      // If canonical's itemName != baseName, rename it
      if (g.canonical.itemName !== g.baseName) {
        try {
          await client.execute({
            sql: `UPDATE Item SET itemName = ? WHERE id = ?`,
            args: [g.baseName, canonicalId],
          });
          renamed++;
          log.push(`  Renamed canonical ${canonicalId} from "${g.canonical.itemName}" to "${g.baseName}"`);
        } catch (e: any) {
          errors.push(`Rename ${canonicalId}: ${e.message}`);
          continue; // skip this group — can't proceed without canonical name
        }
      }

      for (const dup of g.duplicates) {
        try {
          // 1. Move Stock: SUM into canonical, then DELETE duplicates' rows
          //    Use INSERT OR IGNORE / UPDATE to handle the unique (itemId, entityId) constraint.
          const dupStocks = await client.execute({
            sql: `SELECT entityId, SUM(quantity) as qty FROM Stock WHERE itemId = ? GROUP BY entityId`,
            args: [dup.id],
          });
          for (const ds of dupStocks.rows as any[]) {
            // Try to update canonical's stock for this entity
            const existing = await client.execute({
              sql: `SELECT id, quantity FROM Stock WHERE itemId = ? AND entityId = ?`,
              args: [canonicalId, ds.entityId],
            });
            if (existing.rows.length > 0) {
              await client.execute({
                sql: `UPDATE Stock SET quantity = quantity + ? WHERE itemId = ? AND entityId = ?`,
                args: [ds.qty, canonicalId, ds.entityId],
              });
            } else {
              await client.execute({
                sql: `INSERT INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)`,
                args: ['stk_' + Math.random().toString(36).substring(2, 14), canonicalId, ds.entityId, ds.qty],
              });
            }
            stockMoved++;
          }
          // Delete the duplicate's stock rows
          await client.execute({ sql: `DELETE FROM Stock WHERE itemId = ?`, args: [dup.id] });

          // 2. Move ItemBarcode rows
          const dupBarcodes = await client.execute({
            sql: `SELECT id, barcode, entityId, quantity FROM ItemBarcode WHERE itemId = ?`,
            args: [dup.id],
          });
          for (const db of dupBarcodes.rows as any[]) {
            // Update itemId to canonical (the (barcode, entityId) unique constraint might
            // collide if canonical already has the same barcode for the same entity —
            // in that case, sum quantities).
            const existing = await client.execute({
              sql: `SELECT id, quantity FROM ItemBarcode WHERE barcode = ? AND entityId = ?`,
              args: [db.barcode, db.entityId],
            });
            if (existing.rows.length > 0) {
              await client.execute({
                sql: `UPDATE ItemBarcode SET quantity = quantity + ? WHERE barcode = ? AND entityId = ?`,
                args: [db.quantity, db.barcode, db.entityId],
              });
              // Delete the duplicate's row (since we merged into existing)
              await client.execute({ sql: `DELETE FROM ItemBarcode WHERE id = ?`, args: [db.id] });
            } else {
              await client.execute({
                sql: `UPDATE ItemBarcode SET itemId = ? WHERE id = ?`,
                args: [canonicalId, db.id],
              });
            }
            barcodesMoved++;
          }

          // 3. Re-parent relational rows
          //    These have itemId FK — just point them to canonical
          for (const table of ['BookingItem', 'SalesOrderItem', 'DeliveryItem', 'PurchaseItem', 'ItemAdjustment', 'Incentive']) {
            try {
              await client.execute({
                sql: `UPDATE "${table}" SET itemId = ? WHERE itemId = ?`,
                args: [canonicalId, dup.id],
              });
            } catch (e: any) {
              // Some tables might not exist (e.g. Incentive might have FK constraints)
              // — log but don't fail
              if (!errors.some(er => er.includes(table))) {
                errors.push(`Re-parent ${table} for dup ${dup.id}: ${e.message.substring(0, 80)}`);
              }
            }
          }
          // Transfer / Receive have itemId too
          for (const table of ['Transfer', 'Receive']) {
            try {
              await client.execute({
                sql: `UPDATE "${table}" SET itemId = ? WHERE itemId = ?`,
                args: [canonicalId, dup.id],
              });
            } catch (e: any) {
              if (!errors.some(er => er.includes(table))) {
                errors.push(`Re-parent ${table} for dup ${dup.id}: ${e.message.substring(0, 80)}`);
              }
            }
          }

          // 4. Delete the duplicate item
          await client.execute({ sql: `DELETE FROM Item WHERE id = ?`, args: [dup.id] });
          deleted++;
        } catch (e: any) {
          errors.push(`Cleanup dup ${dup.id} (${dup.itemName}): ${e.message}`);
        }
      }
    }

    log.push(`Step 4: Done.`);
    log.push(`  Deleted: ${deleted} duplicate items`);
    log.push(`  Stock entries moved/merged: ${stockMoved}`);
    log.push(`  ItemBarcode rows moved: ${barcodesMoved}`);
    log.push(`  Canonical items renamed: ${renamed}`);
    if (errors.length > 0) {
      log.push(`  Errors: ${errors.length} (first 5: ${errors.slice(0, 5).join('; ')})`);
    }

    // Verify
    const remaining = await client.execute(
      `SELECT COUNT(*) as c FROM Item WHERE itemCode IS NOT NULL AND itemCode != '' AND itemName != itemCode
       AND (itemName LIKE '% %' OR itemName GLOB '*[0-9]')`
    );
    log.push(`  Remaining suspicious items: ${(remaining.rows[0] as any).c}`);

    return NextResponse.json({
      mode: 'execute',
      summary: {
        totalGroups: groups.length,
        duplicatesDeleted: deleted,
        stockMoved,
        barcodesMoved,
        canonicalsRenamed: renamed,
        errors: errors.length,
      },
      errors: errors.slice(0, 20),
      log,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, log }, { status: 500 });
  }
}
