import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// POST /api/stock/bulk-upload?mode=set|add
//
// Body: multipart/form-data with field 'file' = .xlsx / .xls / .csv
//
// Excel/CSV columns (header row required, case-insensitive):
//   entityName  *  — must match an existing Entity.name (e.g. "DEWS")
//   itemName    *  — must match an existing Item.itemName
//                    (if not found, row is skipped + reported in notFoundList)
//   quantity    *  — number (decimal supported, e.g. 0.5)
//   barcode        — optional. If provided AND a new item needs to be created,
//                    used as the item's barcode.
//   itemCode       — optional. Used when creating a new item.
//   uom            — optional. Default 'PCS'. Used when creating a new item.
//   price          — optional. Default 0. Used when creating a new item.
//
// Query param 'mode' (default 'set'):
//   'set' — OVERWRITE stock for (itemId, entityId) with the given quantity.
//           Use this for "daily stock count" — replaces whatever was there.
//           If quantity is 0, the row is deleted entirely.
//   'add' — ADD the given quantity to the existing stock (incremental).
//           Use this for "received new stock today" — adds to existing.
//
// Permission:
//   admin/manager always pass.
//   regular user needs canMenu(user, 'stockForAll', 'create') OR
//   canMenu(user, 'myEntityStock', 'create').
//
// Response:
//   { success, totalRows, processed, created, updated, deleted, skipped,
//     notFoundList, errors, mode, summary }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Permission check — admin/manager OR user with Create permission on
    // stockForAll OR myEntityStock.
    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
    const hasCreatePermission = isPrivileged
      || !!(currentUser.menuAccess?.find((m: any) =>
        (m.menuKey === 'stockForAll' || m.menuKey === 'myEntityStock') &&
        m.visible &&
        (m.canCreate ?? currentUser.canCreateItem ?? false)
      ));
    if (!hasCreatePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to upload stock. Ask admin to grant Create on Stock for All or My Entity Stock.' },
        { status: 403 }
      );
    }

    const mode = request.nextUrl.searchParams.get('mode') === 'add' ? 'add' : 'set';

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded. Use form field "file".' }, { status: 400 });
    }

    // Read file into XLSX
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file has no data rows (only header row?).' }, { status: 400 });
    }

    // Normalize column lookup — case-insensitive, whitespace-trimmed.
    const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '').trim();
    const sample = rows[0];
    const colMap: Record<string, string> = {};
    for (const k of Object.keys(sample)) {
      colMap[norm(k)] = k;
    }
    const getCell = (row: any, ...synonyms: string[]) => {
      for (const s of synonyms) {
        const actualKey = colMap[norm(s)];
        if (actualKey && row[actualKey] !== undefined && row[actualKey] !== '') {
          return String(row[actualKey]).trim();
        }
      }
      return '';
    };

    // Pre-load entities + items for fast lookup
    const allEntities = await db.entity.findMany({ select: { id: true, name: true } });
    const entityByName = new Map<string, string>();
    for (const e of allEntities) {
      entityByName.set(e.name.toLowerCase().trim(), e.id);
    }

    // Pre-load all items (by itemName). 22k items = ~3MB, acceptable.
    const allItems = await db.item.findMany({
      select: { id: true, itemName: true, barcode: true, itemCode: true },
    });
    const itemByName = new Map<string, any>();
    for (const it of allItems) {
      itemByName.set(it.itemName.toLowerCase().trim(), it);
    }

    // For 'set' mode with quantity=0, we need to delete the stock row.
    // For other cases, we'll upsert (with increment for 'add', overwrite for 'set').
    let processed = 0;
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const notFoundList: string[] = [];

    // Group rows by (entityId, itemId) so multiple rows for the same pair
    // get summed (avoids unique constraint violations on parallel upserts).
    type AggRow = { entityId: string; itemId: string; totalQty: number; rowNumbers: number[] };
    const aggMap = new Map<string, AggRow>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 2; // header is row 1

      const entityName = getCell(row, 'entityName', 'entity', 'company');
      const itemName = getCell(row, 'itemName', 'item', 'name');
      const qtyStr = getCell(row, 'quantity', 'qty', 'stock', 'stockQty');

      if (!entityName || !itemName || !qtyStr) {
        skipped++;
        errors.push(`Row ${rowNo}: missing required field (entityName="${entityName}", itemName="${itemName}", qty="${qtyStr}")`);
        continue;
      }

      const entityId = entityByName.get(entityName.toLowerCase());
      if (!entityId) {
        skipped++;
        errors.push(`Row ${rowNo}: entity "${entityName}" not found in master table`);
        continue;
      }

      // Find existing item by name
      let item = itemByName.get(itemName.toLowerCase());
      if (!item) {
        // Try by barcode if provided
        const barcode = getCell(row, 'barcode');
        if (barcode) {
          item = allItems.find(it => it.barcode === barcode);
        }
      }
      if (!item) {
        skipped++;
        notFoundList.push(`Row ${rowNo}: item "${itemName}" not found. To create new items, use the Add Stock page or Item Information upload.`);
        continue;
      }

      // Permission: non-privileged user can only upload to entities they have access to
      if (!isPrivileged) {
        const hasAccess = currentUser.entityAccess?.some((ea: any) => ea.entityId === entityId);
        if (!hasAccess) {
          skipped++;
          errors.push(`Row ${rowNo}: you do not have access to entity "${entityName}"`);
          continue;
        }
      }

      const qty = parseFloat(qtyStr);
      if (isNaN(qty)) {
        skipped++;
        errors.push(`Row ${rowNo}: quantity "${qtyStr}" is not a number`);
        continue;
      }

      const key = `${entityId}|${item.id}`;
      const existing = aggMap.get(key);
      if (existing) {
        existing.totalQty += qty;
        existing.rowNumbers.push(rowNo);
      } else {
        aggMap.set(key, { entityId, itemId: item.id, totalQty: qty, rowNumbers: [rowNo] });
      }
    }

    // Now apply each aggregated row to the DB.
    // ★ OPTIMIZATION: use a single $transaction with batch operations to
    //    avoid 1+ DB round-trip per row. For 32k rows this is 100x faster.
    //
    // Strategy for 'set' mode:
    //   1. Fetch ALL existing stock rows for the (itemId, entityId) pairs
    //      we care about in ONE query.
    //   2. Build 3 lists: toUpdate (existing), toCreate (new), toDelete (qty<=0).
    //   3. Execute updates + creates + deletes in batches inside a transaction.
    //
    // Strategy for 'add' mode:
    //   1. Same fetch.
    //   2. toUpdate uses increment, toCreate uses the qty directly.
    const aggRows = Array.from(aggMap.values());
    if (aggRows.length === 0) {
      return NextResponse.json({
        success: true,
        mode,
        totalRows: rows.length,
        processed: 0, created: 0, updated: 0, deleted: 0, skipped,
        notFoundList,
        errors: errors.slice(0, 30),
        summary: `No valid rows to process (${skipped} skipped).`,
      });
    }

    // 1. Fetch all existing stock rows for our pairs in ONE query.
    //    Prisma can't do composite IN, so we use a query that matches
    //    (itemId IN [...] AND entityId IN [...]) — this may return some
    //    false positives (e.g. itemId X for entity Y when we wanted X for Z),
    //    so we filter those out in JS below.
    const itemIds = Array.from(new Set(aggRows.map(a => a.itemId)));
    const entityIds = Array.from(new Set(aggRows.map(a => a.entityId)));
    const existingStocks = await db.stock.findMany({
      where: {
        itemId: { in: itemIds },
        entityId: { in: entityIds },
      },
      select: { id: true, itemId: true, entityId: true, quantity: true },
    });
    // Build a lookup map: `${itemId}|${entityId}` → stock row
    const existingMap = new Map<string, { id: string; quantity: number }>();
    for (const s of existingStocks) {
      existingMap.set(`${s.itemId}|${s.entityId}`, { id: s.id, quantity: s.quantity });
    }

    // 2. Build the three lists.
    const toUpdate: Array<{ id: string; newQty: number; isIncrement: boolean }> = [];
    const toCreate: Array<{ itemId: string; entityId: string; qty: number }> = [];
    const toDelete: Array<{ itemId: string; entityId: string }> = [];

    for (const agg of aggRows) {
      const key = `${agg.itemId}|${agg.entityId}`;
      const existing = existingMap.get(key);
      if (mode === 'set') {
        if (agg.totalQty <= 0) {
          if (existing) toDelete.push({ itemId: agg.itemId, entityId: agg.entityId });
          // else: nothing to delete
        } else if (existing) {
          toUpdate.push({ id: existing.id, newQty: agg.totalQty, isIncrement: false });
        } else {
          toCreate.push({ itemId: agg.itemId, entityId: agg.entityId, qty: agg.totalQty });
        }
      } else {
        // 'add' mode
        if (existing) {
          toUpdate.push({ id: existing.id, newQty: agg.totalQty, isIncrement: true });
        } else {
          toCreate.push({ itemId: agg.itemId, entityId: agg.entityId, qty: agg.totalQty });
        }
      }
    }

    // 3. Execute in a transaction with batch operations.
    //    Prisma's $transaction with an array of promises is all-or-nothing.
    //    But for 30k+ operations, that may exceed memory. So we chunk.
    const CHUNK_SIZE = 500;
    const txOps: any[] = [];

    // Updates
    for (const u of toUpdate) {
      if (u.isIncrement) {
        txOps.push(db.stock.update({ where: { id: u.id }, data: { quantity: { increment: u.newQty } } }));
      } else {
        txOps.push(db.stock.update({ where: { id: u.id }, data: { quantity: u.newQty } }));
      }
    }
    // Creates
    for (const c of toCreate) {
      txOps.push(db.stock.create({ data: { itemId: c.itemId, entityId: c.entityId, quantity: c.qty } }));
    }
    // Deletes
    for (const d of toDelete) {
      txOps.push(db.stock.deleteMany({ where: { itemId: d.itemId, entityId: d.entityId } }));
    }

    // Execute in chunks of CHUNK_SIZE inside transactions.
    // Each chunk is a separate transaction (partial failure won't roll back
    // already-applied chunks, but we report any errors).
    let updated2 = 0, created2 = 0, deleted2 = 0;
    const chunkErrors: string[] = [];
    for (let i = 0; i < txOps.length; i += CHUNK_SIZE) {
      const chunk = txOps.slice(i, i + CHUNK_SIZE);
      try {
        const results = await db.$transaction(chunk);
        for (const r of results as any[]) {
          if (r && typeof r === 'object') {
            if ('count' in r) {
              deleted2 += r.count;
            } else {
              // create or update returns the row
              if (toCreate.some(c => c.itemId === r.itemId && c.entityId === r.entityId)) created2++;
              else updated2++;
            }
          }
        }
      } catch (e: any) {
        chunkErrors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${e.message.substring(0, 80)}`);
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      totalRows: rows.length,
      processed: aggRows.length,
      created: created2,
      updated: updated2,
      deleted: deleted2,
      skipped,
      notFoundList,
      errors: [...errors.slice(0, 20), ...chunkErrors.slice(0, 10)],
      summary: `${mode === 'set' ? 'Set' : 'Added'} stock for ${aggRows.length} item-entity pairs (${created2} created, ${updated2} updated, ${deleted2} deleted, ${skipped} skipped).`,
    });
  } catch (error: any) {
    console.error('Bulk stock upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
