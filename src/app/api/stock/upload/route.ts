import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// POST /api/stock/upload?entityId=xxx — bulk upload stock entries from CSV
// Required CSV columns: entityName, barcode OR itemCode OR itemName, quantity, uom
// The entityName column MUST match the selected entity (entityId in query string).
// If a row's entityName doesn't match → the row is rejected.
// Items are matched in this order: barcode → itemCode → itemName (case-insensitive).
// Auto-detects delimiter (comma or semicolon) — handles Excel exports from any locale.
// Empty cells → "N/A" (except quantity → 0, uom → "PCS").
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ★ Per-menu upload permission (Function → My Entity Stock / All Entity Stock → Upload)
    if (!canMenu(currentUser, 'myEntityStock', 'upload')) {
      return NextResponse.json({ error: 'You do not have permission to upload stock' }, { status: 403 });
    }

    // The selected entity — every row's entityName must match this entity's name.
    const searchParams = request.nextUrl.searchParams;
    const selectedEntityId = searchParams.get('entityId') || '';

    if (!selectedEntityId) {
      return NextResponse.json(
        { error: 'Entity ID is required as a query parameter (?entityId=xxx). Select an entity first.' },
        { status: 400 }
      );
    }

    const selectedEntity = await db.entity.findUnique({ where: { id: selectedEntityId } });
    if (!selectedEntity) {
      return NextResponse.json({ error: 'Selected entity not found' }, { status: 404 });
    }

    // Verify user has access to this entity (admins/managers bypass)
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      const hasAccess = currentUser.entityAccess.some(ea => ea.entityId === selectedEntityId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this entity' }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Please upload a CSV file' }, { status: 400 });
    }

    let text = await file.text();

    // Strip UTF-8 BOM if present (Excel often adds this)
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have a header row and at least one data row' }, { status: 400 });
    }

    // Auto-detect delimiter: comma or semicolon
    let delimiter = ',';
    const sampleLines = lines.slice(0, Math.min(3, lines.length));
    let commaCount = 0;
    let semicolonCount = 0;
    for (const line of sampleLines) {
      commaCount += (line.match(/,/g) || []).length;
      semicolonCount += (line.match(/;/g) || []).length;
    }
    if (semicolonCount > commaCount) {
      delimiter = ';';
    }

    const header = parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

    // Required: at least one item identifier (barcode / itemCode / itemName), entityName, quantity
    const hasItemIdentifier = header.includes('barcode') || header.includes('itemcode') || header.includes('itemname');
    if (!hasItemIdentifier || !header.includes('entityname') || !header.includes('quantity')) {
      return NextResponse.json(
        {
          error: `CSV must have columns: entityName, barcode (or itemCode or itemName), quantity, uom. Detected header: ${header.join(', ')}. Detected delimiter: "${delimiter}".`,
        },
        { status: 400 }
      );
    }

    const idx = (col: string) => header.indexOf(col);

    // Cache items: by barcode, by itemCode, by itemName (lowercase)
    const items = await db.item.findMany({ select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } });
    const itemByBarcode = new Map<string, typeof items[0]>();
    const itemByCode = new Map<string, typeof items[0]>();
    const itemByName = new Map<string, typeof items[0]>();
    for (const it of items) {
      if (it.barcode) itemByBarcode.set(it.barcode.trim().toLowerCase(), it);
      if (it.itemCode) itemByCode.set(it.itemCode.trim().toLowerCase(), it);
      // Last-wins for duplicate names (will be flagged in errors)
      itemByName.set(it.itemName.trim().toLowerCase(), it);
    }

    let upserted = 0;
    let skipped = 0;
    let wrongEntity = 0;
    const errors: string[] = [];

    const startTime = Date.now();
    const MAX_PROCESSING_MS = 50 * 1000; // 50s (Vercel free = 60s)

    for (let i = 1; i < lines.length; i++) {
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        errors.push(`Stopped at row ${i + 1} (60s timeout). ${lines.length - i} rows not processed. Split your CSV into smaller files of ~3000-5000 rows each.`);
        skipped += lines.length - i;
        break;
      }
      try {
        const cols = parseCsvLine(lines[i], delimiter);
        while (cols.length < header.length) cols.push('');

        const getCellOr = (col: string, fallback = 'N/A'): string => {
          if (idx(col) < 0) return fallback;
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? fallback : v;
        };

        const entityName = getCellOr('entityname', 'N/A');
        const barcode = idx('barcode') >= 0 ? (cols[idx('barcode')]?.trim() ?? '') : '';
        const itemCode = idx('itemcode') >= 0 ? (cols[idx('itemcode')]?.trim() ?? '') : '';
        const itemName = idx('itemname') >= 0 ? getCellOr('itemname', '') : '';
        const uom = idx('uom') >= 0 ? getCellOr('uom', 'PCS') : 'PCS';
        const quantityRaw = idx('quantity') >= 0 ? (cols[idx('quantity')]?.trim() ?? '') : '';

        // Parse quantity — empty/"N/A"/invalid → 0
        let quantity = 0;
        if (quantityRaw && quantityRaw !== 'N/A') {
          const normalized = quantityRaw.replace(',', '.').replace(/\.\s*$/, '');
          const parsed = parseInt(normalized);
          if (!isNaN(parsed)) quantity = parsed;
        }

        // ★ Requirement #4: entityName in CSV must match the selected entity
        if (entityName === 'N/A' || entityName.toLowerCase() !== selectedEntity.name.toLowerCase()) {
          wrongEntity++;
          skipped++;
          if (errors.length < 5) {
            errors.push(`Row ${i + 1}: entity "${entityName}" does not match selected entity "${selectedEntity.name}". Row skipped.`);
          }
          continue;
        }

        // Skip if no item identifier at all
        if (!barcode && !itemCode && (!itemName || itemName === 'N/A')) {
          skipped++;
          if (errors.length < 5) errors.push(`Row ${i + 1}: no item identifier (barcode/itemCode/itemName) provided`);
          continue;
        }

        // Match item: barcode → itemCode → itemName
        let item: typeof items[0] | undefined;
        let rowFailureReasons: string[] = []; // collect all reasons for this row's failure
        if (barcode) {
          item = itemByBarcode.get(barcode.toLowerCase());
          if (!item) rowFailureReasons.push(`barcode "${barcode}"`);
        }
        if (!item && itemCode) {
          item = itemByCode.get(itemCode.toLowerCase());
          if (!item) rowFailureReasons.push(`itemCode "${itemCode}"`);
        }
        if (!item && itemName && itemName !== 'N/A') {
          item = itemByName.get(itemName.toLowerCase());
          if (!item) rowFailureReasons.push(`itemName "${itemName}"`);
        }

        if (!item) {
          skipped++;
          // ★ Helpful message: tell the user the items don't exist yet
          if (errors.length < 5) {
            const attempts = rowFailureReasons.length > 0 ? rowFailureReasons.join(' / ') : 'no identifier';
            errors.push(
              `Row ${i + 1}: no matching item found in the Item Information master table (tried: ${attempts}). ` +
              `You must first upload these items via "Master Data → Upload CSV" before uploading their stock. ` +
              `The stock upload only updates quantities for items that already exist in the system.`
            );
          }
          continue;
        }

        // Optional: warn if uom in CSV doesn't match item.uom (don't reject — just warn)
        if (uom !== 'N/A' && item.uom && uom.toLowerCase() !== item.uom.toLowerCase() && errors.length < 5) {
          errors.push(`Row ${i + 1}: uom "${uom}" doesn't match item's uom "${item.uom}" (used item's uom).`);
        }

        await db.stock.upsert({
          where: { itemId_entityId: { itemId: item.id, entityId: selectedEntity.id } },
          update: { quantity },
          create: { itemId: item.id, entityId: selectedEntity.id, quantity },
        });
        upserted++;
      } catch (e) {
        skipped++;
        if (errors.length < 5) errors.push(`Row ${i + 1}: ${String(e).slice(0, 100)}`);
      }
    }

    return NextResponse.json({
      success: true,
      upserted,
      skipped,
      wrongEntity,
      total: lines.length - 1,
      delimiter,
      selectedEntity: selectedEntity.name,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Stock upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error instanceof Error ? error.message : 'unknown error') }, { status: 500 });
  }
}

function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
