import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/upload — bulk upload stock entries from CSV
// CSV columns: itemName, entityName, quantity (optional: year)
// Auto-detects delimiter (comma or semicolon) — handles Excel exports from any locale
// Empty cells → "N/A" (except quantity → 0)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to upload stock' }, { status: 403 });
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
    const requiredCols = ['itemname', 'entityname', 'quantity'];
    const missing = requiredCols.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missing.join(', ')}. Required columns: ${requiredCols.join(', ')}. Detected delimiter: "${delimiter}". If using Excel, save as "CSV (Comma delimited) (*.csv)".`,
        },
        { status: 400 }
      );
    }

    const idx = (col: string) => header.indexOf(col);

    // Cache entities
    const entities = await db.entity.findMany();
    const entityByName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));

    // Cache items (by name + year)
    const items = await db.item.findMany({ select: { id: true, itemName: true, year: true } });
    const itemByKey = new Map(items.map((i) => [`${i.itemName.toLowerCase()}|${i.year}`.toLowerCase(), i]));

    let upserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    const startTime = Date.now();
    const MAX_PROCESSING_MS = 50 * 1000; // 50 seconds (Vercel free plan maxDuration = 60s)

    for (let i = 1; i < lines.length; i++) {
      // Time budget check
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        errors.push(`Stopped at row ${i + 1} (60s timeout). ${lines.length - i} rows not processed. Split your CSV into smaller files of ~3000-5000 rows each.`);
        skipped += lines.length - i;
        break;
      }
      try {
        const cols = parseCsvLine(lines[i], delimiter);
        // Pad missing columns with empty strings
        while (cols.length < header.length) cols.push('');

        const getCellOr = (col: string, fallback = 'N/A'): string => {
          if (idx(col) < 0) return fallback;
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? fallback : v;
        };

        const itemName = getCellOr('itemname', 'N/A');
        const entityName = getCellOr('entityname', 'N/A');
        const quantityRaw = idx('quantity') >= 0 ? (cols[idx('quantity')]?.trim() ?? '') : '';
        // Parse quantity — empty/"N/A"/invalid → 0
        let quantity = 0;
        if (quantityRaw && quantityRaw !== 'N/A') {
          // Handle both "100" and European formats
          const normalized = quantityRaw.replace(',', '.').replace(/\.\s*$/, '');
          const parsed = parseInt(normalized);
          if (!isNaN(parsed)) quantity = parsed;
        }
        const year = idx('year') >= 0 ? getCellOr('year', '') : '';

        // Skip only if BOTH itemName AND entityName are missing/N/A
        if ((itemName === 'N/A' || !itemName) && (entityName === 'N/A' || !entityName)) {
          skipped++;
          continue;
        }

        const entity = entityByName.get(entityName.toLowerCase());
        if (!entity) {
          skipped++;
          if (errors.length < 5) errors.push(`Row ${i + 1}: entity "${entityName}" not found`);
          continue;
        }

        // Find item by name (and year if provided)
        const key = year && year !== 'N/A' ? `${itemName}|${year}`.toLowerCase() : null;
        const item = key ? itemByKey.get(key) : items.find((it) => it.itemName.toLowerCase() === itemName.toLowerCase());

        if (!item) {
          skipped++;
          if (errors.length < 5) errors.push(`Row ${i + 1}: item "${itemName}"${year && year !== 'N/A' ? ` (${year})` : ''} not found`);
          continue;
        }

        await db.stock.upsert({
          where: { itemId_entityId: { itemId: item.id, entityId: entity.id } },
          update: { quantity },
          create: { itemId: item.id, entityId: entity.id, quantity },
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
      total: lines.length - 1,
      delimiter,
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
