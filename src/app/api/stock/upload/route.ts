import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/upload — bulk upload stock entries from CSV
// CSV columns: itemName, year, entityName, quantity
// (matches by itemName + year → itemId, by entityName → entityId)
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

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have a header row and at least one data row' }, { status: 400 });
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const requiredCols = ['itemname', 'entityname', 'quantity'];
    const missing = requiredCols.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missing.join(', ')}. Required: ${requiredCols.join(', ')}` },
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

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCsvLine(lines[i]);
        // Pad missing columns with empty strings
        while (cols.length < header.length) cols.push('');

        // Helper: get cell value, empty/undefined → fallback (default 'N/A')
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
          const parsed = parseInt(quantityRaw);
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
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Stock upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function parseCsvLine(line: string): string[] {
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
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
