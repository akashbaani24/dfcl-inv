import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { db } from '@/lib/db';

// GET /api/admin/debug-batch?token=DFCL_RESCUE_2026
// Temporary debug endpoint: checks if Transfer.batchId column exists and is being populated.
// POST /api/admin/debug-batch?token=DFCL_RESCUE_2026&action=test-create
//   Creates a test transfer with batchId via Prisma, then reads it back to verify.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const action = request.nextUrl.searchParams.get('action') || 'check';

  // ★ Test create: insert a transfer with batchId via Prisma, then read it back.
  // This verifies that the Prisma client on Vercel knows about the batchId field.
  if (action === 'test-create') {
    try {
      // Find any existing item + entity to use for the test transfer
      const firstItem = await db.item.findFirst({ select: { id: true, itemName: true } });
      const firstEntity = await db.entity.findFirst({ select: { id: true, name: true } });
      if (!firstItem || !firstEntity) {
        return NextResponse.json({ error: 'No items or entities found for test' }, { status: 400 });
      }
      const secondEntity = await db.entity.findFirst({ where: { id: { not: firstEntity.id } }, select: { id: true, name: true } });
      if (!secondEntity) {
        return NextResponse.json({ error: 'Need at least 2 entities for test' }, { status: 400 });
      }

      const testBatchId = `TEST-BATCH-${Date.now()}`;
      const created = await db.transfer.create({
        data: {
          itemId: firstItem.id,
          fromEntityId: firstEntity.id,
          toEntityId: secondEntity.id,
          quantity: 1,
          status: 'cancelled',  // ★ use cancelled so it doesn't affect real stock/incoming lists
          batchId: testBatchId,
          notes: 'DEBUG TEST — safe to delete',
        },
      });

      // Read it back
      const readBack = await db.transfer.findUnique({ where: { id: created.id }, select: { id: true, batchId: true, notes: true } });

      // Clean up — delete the test transfer
      await db.transfer.delete({ where: { id: created.id } });

      return NextResponse.json({
        testBatchId,
        createdId: created.id,
        readBackBatchId: readBack?.batchId,
        batchIdMatched: readBack?.batchId === testBatchId,
        message: readBack?.batchId === testBatchId
          ? '✅ Prisma client correctly saves batchId. The fix is working — user just needs to create NEW transfers after hard refresh.'
          : '❌ Prisma client is NOT saving batchId. The deployed Prisma client may be stale.',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
  }

  // Default: check current state
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

