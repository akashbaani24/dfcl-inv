import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMasterData } from '@/lib/auth';

// POST /api/items/update-barcodes
// Bulk-update barcode + itemCode on EXISTING items based on a CSV file.
// CSV columns: itemName (required, used to find the item) + barcode + itemCode (either or both)
//
// This is useful when items were uploaded without the barcode/itemCode columns
// and you want to retroactively add those identifiers.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMasterData(currentUser, 'upload', 'upload')) {
      return NextResponse.json({ error: 'You do not have permission to update items' }, { status: 403 });
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
    // Strip UTF-8 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    // Auto-detect delimiter
    let delimiter = ',';
    let commaCount = 0, semicolonCount = 0;
    for (const line of lines.slice(0, 3)) {
      commaCount += (line.match(/,/g) || []).length;
      semicolonCount += (line.match(/;/g) || []).length;
    }
    if (semicolonCount > commaCount) delimiter = ';';

    const header = parseCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());

    // Require itemName column. Optional: barcode, itemCode.
    if (!header.includes('itemname')) {
      return NextResponse.json({
        error: `CSV must have an "itemName" column (case-insensitive). Detected columns: ${header.join(', ')}. Detected delimiter: "${delimiter}".`,
      }, { status: 400 });
    }

    const idx = (col: string) => header.indexOf(col);

    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    const errors: string[] = [];
    const notFoundList: string[] = [];

    // Cache existing items by itemName (lowercase) for fast lookup
    const allItems = await db.item.findMany({ select: { id: true, itemName: true, barcode: true, itemCode: true } });
    const byName = new Map<string, typeof allItems[0]>();
    for (const it of allItems) {
      byName.set(it.itemName.trim().toLowerCase(), it);
    }

    // Collect updates to apply
    const updates: Array<{ id: string; itemName: string; barcode: string | null; itemCode: string | null }> = [];
    const duplicateBarcodes = new Set<string>();
    const existingBarcodes = new Set<string>();
    for (const it of allItems) {
      if (it.barcode) existingBarcodes.add(it.barcode.trim().toLowerCase());
    }

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCsvLine(lines[i], delimiter);
        while (cols.length < header.length) cols.push('');

        const itemName = (cols[idx('itemname')]?.trim() || '').trim();
        if (!itemName) {
          skipped++;
          if (errors.length < 10) errors.push(`Row ${i + 1}: empty itemName — skipped`);
          continue;
        }

        const existing = byName.get(itemName.toLowerCase());
        if (!existing) {
          notFound++;
          notFoundList.push(`Row ${i + 1}: itemName "${itemName}" not found in master table`);
          if (errors.length < 20) errors.push(`Row ${i + 1}: itemName "${itemName}" not found in master table`);
          continue;
        }

        const barcodeRaw = idx('barcode') >= 0 ? (cols[idx('barcode')]?.trim() || '') : '';
        const itemCodeRaw = idx('itemcode') >= 0 ? (cols[idx('itemcode')]?.trim() || '') : '';
        const newBarcode = barcodeRaw && barcodeRaw !== 'N/A' ? barcodeRaw : null;
        const newItemCode = itemCodeRaw && itemCodeRaw !== 'N/A' ? itemCodeRaw : null;

        // Skip if neither field has a value
        if (!newBarcode && !newItemCode) {
          skipped++;
          if (errors.length < 10) errors.push(`Row ${i + 1}: no barcode or itemCode provided for "${itemName}" — skipped`);
          continue;
        }

        // Check for duplicate barcode (if a new barcode is being set)
        if (newBarcode) {
          const bcLower = newBarcode.toLowerCase();
          if (existingBarcodes.has(bcLower) && existing.barcode?.toLowerCase() !== bcLower) {
            duplicateBarcodes.add(newBarcode);
            if (errors.length < 20) errors.push(`Row ${i + 1}: barcode "${newBarcode}" already exists on another item — skipped`);
            skipped++;
            continue;
          }
          existingBarcodes.add(bcLower);
        }

        updates.push({ id: existing.id, itemName: existing.itemName, barcode: newBarcode, itemCode: newItemCode });
      } catch (e) {
        skipped++;
        if (errors.length < 10) errors.push(`Row ${i + 1}: ${String(e).slice(0, 100)}`);
      }
    }

    // Apply updates one by one (only set non-null fields)
    for (const u of updates) {
      try {
        const data: { barcode?: string; itemCode?: string } = {};
        if (u.barcode) data.barcode = u.barcode;
        if (u.itemCode) data.itemCode = u.itemCode;
        await db.item.update({ where: { id: u.id }, data });
        updated++;
      } catch (e) {
        skipped++;
        if (errors.length < 20) errors.push(`Failed to update "${u.itemName}": ${String(e).slice(0, 100)}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      notFound,
      skipped,
      total: lines.length - 1,
      delimiter,
      duplicateBarcodes: Array.from(duplicateBarcodes),
      notFoundList: notFoundList.length > 0 ? notFoundList.slice(0, 20) : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Update item barcodes error:', error);
    return NextResponse.json({ error: 'Update failed: ' + (error instanceof Error ? error.message : 'unknown error') }, { status: 500 });
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
