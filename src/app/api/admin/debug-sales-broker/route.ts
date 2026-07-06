import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { db } from '@/lib/db';

// GET /api/admin/debug-sales-broker?token=DFCL_RESCUE_2026
// Verifies whether the hasBroker column exists in the SalesOrder table AND
// whether the Prisma client on Vercel knows about it.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const out: any = { steps: [] };

  // 1. Raw SQL: check SalesOrder table schema
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl && tursoToken) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    try {
      const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='SalesOrder'");
      out.steps.push({ step: 'SalesOrder table schema', sql: r.rows[0]?.sql ?? 'NOT FOUND' });
    } catch (e: any) {
      out.steps.push({ step: 'SalesOrder table schema', error: e.message });
    }

    // 2. Raw SQL: select id, salesNo, hasBroker from last 10 sales orders
    try {
      const r = await client.execute('SELECT id, salesNo, hasBroker FROM SalesOrder ORDER BY createdAt DESC LIMIT 10');
      out.steps.push({
        step: 'Raw SQL: id, salesNo, hasBroker (last 10)',
        count: r.rows.length,
        rows: r.rows,
      });
    } catch (e: any) {
      out.steps.push({ step: 'Raw SQL: id, salesNo, hasBroker', error: e.message });
    }
  }

  // 3. Prisma client: does it know about hasBroker?
  try {
    const orders = await db.salesOrder.findMany({
      select: { id: true, salesNo: true, hasBroker: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    out.steps.push({
      step: 'Prisma client query',
      count: orders.length,
      hasHasBrokerField: orders.length > 0 ? 'hasBroker' in orders[0] : false,
      sample: orders[0],
      allHaveTrue: orders.filter((o: any) => o.hasBroker === true).length,
    });
  } catch (e: any) {
    out.steps.push({ step: 'Prisma client query', error: e.message });
  }

  return NextResponse.json(out);
}
