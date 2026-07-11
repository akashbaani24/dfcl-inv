import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';
import { readFileSync } from 'fs';
import { join } from 'path';

// POST /api/admin/add-production-transfers?token=DFCL_RESCUE_2026
// Reads the production transfer data file, creates Transfers from
// "M/S Anchor Enterprise" → "Production Dekhaba", and moves stock.

type Row = { date: string; itemName: string; quantity: number; uom: string };

function parseDate(s: string): string {
  const parts = s.trim().split('/');
  if (parts.length !== 3) return new Date().toISOString().split('T')[0];
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function normalizeItemName(name: string): string {
  let n = name.trim();
  const lower = n.toLowerCase();
  if (lower.startsWith('cornner')) n = n.replace(/ornner/i, 'orner');
  if (lower === 'lace') n = 'Lace';
  if (lower.includes('81x69x')) n = n.replace(/81x69x/i, '81X69X');
  return n;
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const results = { entityFrom: '', entityTo: '', transfersCreated: 0, itemsProcessed: 0, itemsNotFound: [] as string[], stockUpdated: 0, errors: [] as any[] };

  try {
    // Step 1: Find/create entities
    const entityFrom = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entityFrom) return NextResponse.json({ error: 'M/S Anchor Enterprise not found' }, { status: 404 });
    results.entityFrom = entityFrom.name;

    let entityTo = await db.entity.findFirst({ where: { name: { contains: 'Production Dekhaba' } } });
    if (!entityTo) {
      entityTo = await db.entity.create({ data: { name: 'Production Dekhaba', description: 'Production unit', entityType: 'factory' } });
    }
    results.entityTo = entityTo.name;

    // Step 2: Read file (try multiple paths — Vercel puts files in different locations)
    let fileContent: string;
    const paths = [
      join(process.cwd(), 'upload', 'production-transfers.txt'),
      join(process.cwd(), 'public', 'upload', 'production-transfers.txt'),
      join('/tmp', 'production-transfers.txt'),
    ];
    let fileRead = false;
    for (const p of paths) {
      try { fileContent = readFileSync(p, 'utf-8'); fileRead = true; break; } catch {}
    }
    if (!fileRead) {
      // Fallback: embed a small subset for testing
      return NextResponse.json({ error: 'File not found. Tried: ' + paths.join(', ') }, { status: 500 });
    }
    fileContent = fileContent!;
    const lines = fileContent.split('\n').filter(l => l.trim());

    const rows: Row[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 4) continue;
      const date = parseDate(parts[0]);
      const itemName = normalizeItemName(parts[1].trim());
      const qty = parseFloat(parts[2].trim()) || 0;
      const uom = parts[3]?.trim() || 'PCS';
      if (qty > 0) rows.push({ date, itemName, quantity: qty, uom });
    }

    // Step 3: Build item lookup (case-insensitive)
    const allItems = await db.item.findMany({ select: { id: true, itemName: true } });
    const itemMap = new Map<string, string>();
    for (const item of allItems) itemMap.set(item.itemName.toLowerCase(), item.id);

    function findItemId(name: string): string | null {
      // Try exact, then variants
      const variants = [name, name.replace(/Ribbond/g, 'Ribbon'), name.replace(/Cornner/g, 'Corner'), name.replace(/Ribbond/g, 'Ribbon').replace(/Cornner/g, 'Corner')];
      for (const v of variants) {
        if (itemMap.has(v.toLowerCase())) return itemMap.get(v.toLowerCase())!;
      }
      return null;
    }

    // Step 4: Create transfers + move stock
    const batchId = `TB-PROD-${Date.now()}`;
    let tc = 0;

    // Group by date for batchId efficiency
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const arr = groups.get(row.date) || [];
      arr.push(row);
      groups.set(row.date, arr);
    }

    for (const [dateStr, dateRows] of groups.entries()) {
      for (const row of dateRows) {
        const itemId = findItemId(row.itemName);
        if (!itemId) {
          if (!results.itemsNotFound.includes(row.itemName)) results.itemsNotFound.push(row.itemName);
          continue;
        }
        try {
          await db.transfer.create({
            data: {
              itemId,
              fromEntityId: entityFrom.id,
              toEntityId: entityTo.id,
              quantity: row.quantity,
              status: 'completed',
              batchId,
              notes: `Production transfer — ${dateStr}`,
            },
          });
          tc++;
          results.itemsProcessed++;
          // Decrement stock at Anchor Enterprise
          try { await applyStockDelta(db, itemId, entityFrom.id, -row.quantity); } catch (e: any) {}
          // Increment stock at Production Dekhaba
          try { await applyStockDelta(db, itemId, entityTo.id, row.quantity); results.stockUpdated++; } catch (e: any) {}
        } catch (e: any) { results.errors.push({ item: row.itemName, date: dateStr, error: e.message }); }
      }
    }

    results.transfersCreated = tc;
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
