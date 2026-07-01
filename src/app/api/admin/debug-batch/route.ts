import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// GET /api/admin/debug-batch?token=DFCL_RESCUE_2026
// Temporary debug endpoint: checks if Transfer.batchId column exists and is being populated.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    return NextResponse.json({ error: 'Turso env vars not set' }, { status: 500 });
  }

  const client = createClient({ url: tursoUrl, authToken: tursoToken });
  const out: any = { steps: [] };

  // 1. Transfer table schema
  try {
    const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Transfer'");
    out.steps.push({ step: 'Transfer table schema', sql: r.rows[0]?.sql ?? 'NOT FOUND' });
  } catch (e: any) {
    out.steps.push({ step: 'Transfer table schema', error: e.message });
  }

  // 2. Last 15 transfers
  try {
    const r = await client.execute('SELECT id, itemId, barcode, batchId, status, createdAt FROM Transfer ORDER BY createdAt DESC LIMIT 15');
    out.steps.push({ step: 'Last 15 transfers', count: r.rows.length, rows: r.rows });
  } catch (e: any) {
    out.steps.push({ step: 'Last 15 transfers', error: e.message });
  }

  // 3. Count of transfers with batchId set
  try {
    const r = await client.execute("SELECT COUNT(*) as cnt FROM Transfer WHERE batchId IS NOT NULL");
    out.steps.push({ step: 'Transfers with batchId', count: r.rows[0]?.cnt });
  } catch (e: any) {
    out.steps.push({ step: 'Transfers with batchId', error: e.message });
  }

  // 4. Group by batchId
  try {
    const r = await client.execute("SELECT batchId, COUNT(*) as cnt, GROUP_CONCAT(itemId) as itemIds FROM Transfer WHERE batchId IS NOT NULL GROUP BY batchId ORDER BY cnt DESC LIMIT 10");
    out.steps.push({ step: 'Grouped by batchId', batches: r.rows });
  } catch (e: any) {
    out.steps.push({ step: 'Grouped by batchId', error: e.message });
  }

  return NextResponse.json(out);
}
