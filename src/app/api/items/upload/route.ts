import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/items/upload — bulk upload items from CSV
// CSV columns: year, lcNo, group, subGroup, itemName, price, uom
// Auto-detects delimiter (comma or semicolon) — handles Excel exports from any locale
// Empty cells → "N/A" (except price → 0, uom → "PCS")
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canCreateItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to upload items' }, { status: 403 });
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
    // Count occurrences in first 3 lines, use whichever appears more
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

    // Parse header
    const header = parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
    const requiredCols = ['year', 'lcno', 'group', 'subgroup', 'itemname', 'price', 'uom'];
    const missing = requiredCols.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missing.join(', ')}. Required columns: ${requiredCols.join(', ')}. Detected delimiter: "${delimiter}". If you are using Excel, make sure to save as "CSV (Comma delimited) (*.csv)" not "CSV (semicolon delimited)".`,
        },
        { status: 400 }
      );
    }

    const idx = (col: string) => header.indexOf(col);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCsvLine(lines[i], delimiter);
        // Pad missing columns with empty strings
        while (cols.length < header.length) cols.push('');

        // Helper: get cell value, empty/undefined → fallback (default 'N/A')
        const getCell = (col: string): string => {
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? 'N/A' : v;
        };
        const getCellOr = (col: string, fallback = 'N/A'): string => {
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? fallback : v;
        };

        const year = getCellOr('year', 'N/A');
        const itemName = getCellOr('itemname', 'N/A');

        // Skip only if BOTH year AND itemName are missing/N/A
        if ((year === 'N/A' || !year) && (itemName === 'N/A' || !itemName)) {
          skipped++;
          continue;
        }

        // Parse price — empty → 0, "N/A" → 0, invalid → 0
        const priceRaw = cols[idx('price')]?.trim() ?? '';
        let price = 0;
        if (priceRaw && priceRaw !== 'N/A') {
          // Handle both "100.50" and "100,50" (European decimal)
          const normalized = priceRaw.replace(',', '.');
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) price = parsed;
        }

        await db.item.create({
          data: {
            year,
            lcNo: getCell('lcno'),
            group: getCell('group'),
            subGroup: getCell('subgroup'),
            itemName,
            price,
            uom: getCellOr('uom', 'PCS'),
            createdBy: currentUser.id,
          },
        });
        inserted++;
      } catch (e) {
        skipped++;
        if (errors.length < 5) {
          errors.push(`Row ${i + 1}: ${String(e).slice(0, 100)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: lines.length - 1,
      delimiter,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Item upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error instanceof Error ? error.message : 'unknown error') }, { status: 500 });
  }
}

// Parse a CSV line with specified delimiter — handles basic quoted fields
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
