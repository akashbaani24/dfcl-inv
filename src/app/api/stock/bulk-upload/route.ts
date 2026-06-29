import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// POST /api/stock/bulk-upload
//
// Bulk upload stock. No mode selector — always overwrites (set behavior).
// Each row is processed independently (no aggregation/summing of duplicate rows).
// If the same (entityName, itemName) appears multiple times, the LAST row wins.
//
// CSV/Excel columns: entityName, itemName, quantity
// (barcode, itemCode, uom, group, subGroup — all auto-detected from Item Information)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Permission check
    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
    const hasCreatePermission = isPrivileged
      || !!(currentUser.menuAccess?.find((m: any) =>
        (m.menuKey === 'stockForAll' || m.menuKey === 'myEntityStock') &&
        m.visible &&
        (m.canCreate ?? false)
      ));
    if (!hasCreatePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to upload stock.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Read file
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file has no data rows.' }, { status: 400 });
    }

    // Normalize column lookup
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

    // Pre-load entities (by name + shortCode)
    const allEntities = await db.entity.findMany({ select: { id: true, name: true, shortCode: true } });
    const entityByName = new Map<string, string>();
    for (const e of allEntities) {
      entityByName.set(e.name.toLowerCase().trim(), e.id);
      if (e.shortCode) {
        entityByName.set(e.shortCode.toUpperCase().trim(), e.id);
      }
    }

    // Pre-load all items (by itemName)
    const allItems = await db.item.findMany({ select: { id: true, itemName: true } });
    const itemByName = new Map<string, any>();
    for (const it of allItems) {
      itemByName.set(it.itemName.toLowerCase().trim(), it);
    }

    let processed = 0;
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const notFoundList: string[] = [];

    // ★ NO AGGREGATION — each row is independent.
    // If the same (entityId, itemId) appears multiple times, the LAST row wins
    // (because we process sequentially and the last upsert overwrites).
    // Use a Map to keep only the last occurrence of each (entityId, itemId) pair.
    const finalRows = new Map<string, { entityId: string; itemId: string; qty: number; rowNo: number }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 2;

      const entityName = getCell(row, 'entityName', 'entity', 'company');
      const itemName = getCell(row, 'itemName', 'item', 'name');
      const qtyStr = getCell(row, 'quantity', 'qty', 'stock', 'stockQty');

      if (!entityName || !itemName || !qtyStr) {
        skipped++;
        errors.push(`Row ${rowNo}: missing required field`);
        continue;
      }

      const entityId = entityByName.get(entityName.toLowerCase()) || entityByName.get(entityName.toUpperCase());
      if (!entityId) {
        skipped++;
        errors.push(`Row ${rowNo}: entity "${entityName}" not found`);
        continue;
      }

      const item = itemByName.get(itemName.toLowerCase());
      if (!item) {
        skipped++;
        notFoundList.push(`Row ${rowNo}: item "${itemName}" not found`);
        continue;
      }

      if (!isPrivileged) {
        const hasAccess = currentUser.entityAccess?.some((ea: any) => ea.entityId === entityId);
        if (!hasAccess) {
          skipped++;
          errors.push(`Row ${rowNo}: no access to entity "${entityName}"`);
          continue;
        }
      }

      const qty = parseFloat(qtyStr);
      if (isNaN(qty)) {
        skipped++;
        errors.push(`Row ${rowNo}: quantity "${qtyStr}" is not a number`);
        continue;
      }

      // ★ Key = (entityId, itemId). Last row wins (no summing).
      const key = `${entityId}|${item.id}`;
      finalRows.set(key, { entityId, itemId: item.id, qty, rowNo });
    }

    // Build operations
    const aggRows = Array.from(finalRows.values());
    if (aggRows.length === 0) {
      return NextResponse.json({
        success: true,
        totalRows: rows.length,
        processed: 0, created: 0, updated: 0, deleted: 0, skipped,
        notFoundList,
        errors: errors.slice(0, 30),
        summary: `No valid rows (${skipped} skipped).`,
      });
    }

    // Fetch existing stock rows
    const itemIds = Array.from(new Set(aggRows.map(a => a.itemId)));
    const entityIds = Array.from(new Set(aggRows.map(a => a.entityId)));
    const existingStocks = await db.stock.findMany({
      where: { itemId: { in: itemIds }, entityId: { in: entityIds } },
      select: { id: true, itemId: true, entityId: true, quantity: true },
    });
    const existingMap = new Map<string, { id: string; quantity: number }>();
    for (const s of existingStocks) {
      existingMap.set(`${s.itemId}|${s.entityId}`, { id: s.id, quantity: s.quantity });
    }

    // Build operation lists
    const toUpdate: Array<{ id: string; newQty: number }> = [];
    const toCreate: Array<{ itemId: string; entityId: string; qty: number }> = [];
    const toDelete: Array<{ itemId: string; entityId: string }> = [];

    for (const agg of aggRows) {
      const key = `${agg.itemId}|${agg.entityId}`;
      const existing = existingMap.get(key);
      if (agg.qty <= 0) {
        if (existing) toDelete.push({ itemId: agg.itemId, entityId: agg.entityId });
      } else if (existing) {
        toUpdate.push({ id: existing.id, newQty: agg.qty });
      } else {
        toCreate.push({ itemId: agg.itemId, entityId: agg.entityId, qty: agg.qty });
      }
    }

    // Execute in chunks
    const CHUNK_SIZE = 500;
    const txOps: any[] = [];

    for (const u of toUpdate) {
      txOps.push(db.stock.update({ where: { id: u.id }, data: { quantity: u.newQty } }));
    }
    for (const c of toCreate) {
      txOps.push(db.stock.create({ data: { itemId: c.itemId, entityId: c.entityId, quantity: c.qty } }));
    }
    for (const d of toDelete) {
      txOps.push(db.stock.deleteMany({ where: { itemId: d.itemId, entityId: d.entityId } }));
    }

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
      totalRows: rows.length,
      processed: aggRows.length,
      created: created2,
      updated: updated2,
      deleted: deleted2,
      skipped,
      notFoundList,
      errors: [...errors.slice(0, 20), ...chunkErrors.slice(0, 10)],
      summary: `Stock updated for ${aggRows.length} item-entity pairs (${created2} created, ${updated2} updated, ${deleted2} deleted, ${skipped} skipped).`,
    });
  } catch (error: any) {
    console.error('Bulk stock upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
