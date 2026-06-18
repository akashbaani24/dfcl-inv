import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@libsql/client';

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
    let duplicate = 0;
    const errors: string[] = [];

    // Cache existing itemNames from DB for fast duplicate check
    // RULE: Only itemName is checked for duplicates — year, lcNo, group, subGroup, price, uom
    // can all be duplicates without issue.
    const existingItems = await db.item.findMany({
      select: { itemName: true },
    });
    const existingNames = new Set(
      existingItems.map(i => i.itemName.toLowerCase())
    );
    // Also track duplicates within this same upload
    const seenInThisUpload = new Set<string>();

    // Parse all rows first, then batch-insert to avoid Vercel's 10s timeout
    const rowsToInsert: Array<{
      year: string;
      lcNo: string;
      group: string;
      subGroup: string;
      itemName: string;
      price: number;
      uom: string;
      createdBy: string;
    }> = [];

    const startTime = Date.now();
    const MAX_PROCESSING_MS = 50 * 1000; // 50 seconds — Vercel free plan maxDuration is 60s, leave 10s buffer for batch insert

    for (let i = 1; i < lines.length; i++) {
      // Time budget check — stop processing if we're near Vercel's timeout
      if (Date.now() - startTime > MAX_PROCESSING_MS) {
        errors.push(`Stopped at row ${i + 1} (60s timeout). ${lines.length - i} rows not processed. Split your CSV into smaller files of ~3000-5000 rows each, or upgrade Vercel to Pro plan for 5min timeout.`);
        skipped += lines.length - i;
        break;
      }

      try {
        const cols = parseCsvLine(lines[i], delimiter);
        while (cols.length < header.length) cols.push('');

        const getCell = (col: string): string => {
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? 'N/A' : v;
        };
        const getCellOr = (col: string, fallback = 'N/A'): string => {
          const v = cols[idx(col)]?.trim() ?? '';
          return v === '' ? fallback : v;
        };

        const itemName = getCellOr('itemname', 'N/A');

        // Skip only if itemName is completely missing (N/A and empty)
        // No other column is mandatory
        if (itemName === 'N/A' || !itemName) {
          skipped++;
          continue;
        }

        // DUPLICATE CHECK: only by itemName (case-insensitive)
        const key = itemName.toLowerCase();
        if (existingNames.has(key) || seenInThisUpload.has(key)) {
          duplicate++;
          if (errors.length < 10) {
            errors.push(`Row ${i + 1}: duplicate item "${itemName}" — skipped`);
          }
          continue;
        }
        seenInThisUpload.add(key);

        // Other columns can be empty/N/A — no required fields
        const year = getCellOr('year', 'N/A');
        const priceRaw = cols[idx('price')]?.trim() ?? '';
        let price = 0;
        if (priceRaw && priceRaw !== 'N/A') {
          const normalized = priceRaw.replace(',', '.');
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) price = parsed;
        }

        rowsToInsert.push({
          year,
          lcNo: getCell('lcno'),
          group: getCell('group'),
          subGroup: getCell('subgroup'),
          itemName,
          price,
          uom: getCellOr('uom', 'PCS'),
          createdBy: currentUser.id,
        });
      } catch (e) {
        skipped++;
        if (errors.length < 10) {
          errors.push(`Row ${i + 1}: ${String(e).slice(0, 100)}`);
        }
      }
    }

    // BATCH INSERT: Use multi-row INSERT for maximum speed
    // Single INSERT with multiple VALUES is 10-50x faster than individual INSERTs
    const tursoUrl = process.env.TURSO_DATABASE_URL
    const tursoToken = process.env.TURSO_AUTH_TOKEN

    // Generate cuid-like ID in JavaScript
    function generateId(): string {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      const timestamp = Date.now().toString(36)
      let random = ''
      for (let i = 0; i < 20; i++) random += chars[Math.floor(Math.random() * chars.length)]
      return `c${timestamp}${random}`.slice(0, 24)
    }

    if (tursoUrl && tursoToken && rowsToInsert.length > 0) {
      const libsql = createClient({ url: tursoUrl, authToken: tursoToken })

      // Build multi-row INSERT statements
      // SQLite param limit is 999. With 10 params per row (id + 9 fields), max ~99 rows.
      // Use 70 rows per statement (70 × 10 = 700 params, safely under 999).
      // ALL statements sent in ONE HTTP request via libsql.batch()
      const ROWS_PER_STATEMENT = 70
      const stmts: Array<{ sql: string; args: (string | number)[] }> = []

      for (let i = 0; i < rowsToInsert.length; i += ROWS_PER_STATEMENT) {
        const batch = rowsToInsert.slice(i, i + ROWS_PER_STATEMENT)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime(\'now\'), datetime(\'now\'))').join(', ')
        const args: (string | number)[] = []
        for (const row of batch) {
          args.push(generateId(), row.year, row.lcNo, row.group, row.subGroup, row.itemName, row.price, row.uom, row.createdBy)
        }
        stmts.push({
          sql: `INSERT OR IGNORE INTO "Item" ("id", "year", "lcNo", "group", "subGroup", "itemName", "price", "uom", "supplierId", "createdBy", "updatedBy", "createdAt", "updatedAt") VALUES ${placeholders}`,
          args,
        })
      }

      // Send ALL statements in ONE HTTP request
      try {
        const results = await libsql.batch(stmts, 'write')
        for (const r of results) {
          inserted += r.rows_affected || 0
        }
      } catch (e) {
        console.error('Batch insert failed:', String(e).slice(0, 300))
        // Fallback: try Prisma createMany
        try {
          const result = await db.item.createMany({ data: rowsToInsert, skipDuplicates: true })
          inserted += result.count
        } catch (e2) {
          // Last resort: one by one
          for (const row of rowsToInsert) {
            try {
              await db.item.create({ data: row })
              inserted++
            } catch {
              skipped++
            }
          }
        }
      }
    } else {
      // Fallback: use Prisma (when not on Vercel/Turso — e.g. local dev)
      const BATCH_SIZE = 100
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
        try {
          const result = await db.item.createMany({ data: batch, skipDuplicates: true })
          inserted += result.count
        } catch (e) {
          for (const row of batch) {
            try {
              await db.item.create({ data: row })
              inserted++
            } catch {
              skipped++
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      duplicate,
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
