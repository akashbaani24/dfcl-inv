import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { db } from '@/lib/db';

// GET /api/admin/debug-entities-full?token=DFCL_RESCUE_2026
// Returns all entities with ALL fields (including address, phone, logo) so we can verify
// whether the migration applied and whether the Prisma client on Vercel knows about the
// new columns.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const out: any = { steps: [] };

  // 1. Check Entity table schema (raw SQL)
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl && tursoToken) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    try {
      const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Entity'");
      out.steps.push({ step: 'Entity table schema', sql: r.rows[0]?.sql ?? 'NOT FOUND' });
    } catch (e: any) {
      out.steps.push({ step: 'Entity table schema', error: e.message });
    }

    // 2. Raw SQL: select address, phone, logo directly
    try {
      const r = await client.execute('SELECT id, name, address, phone, logo FROM Entity ORDER BY name ASC');
      out.steps.push({
        step: 'Raw SQL: address + phone + logo',
        count: r.rows.length,
        rows: r.rows.map((row: any) => ({
          name: row.name,
          address: row.address,
          phone: row.phone,
          logo: row.logo ? `(logo set, ${String(row.logo).length} chars)` : null,
        })),
      });
    } catch (e: any) {
      out.steps.push({ step: 'Raw SQL: address + phone + logo', error: e.message });
    }
  }

  // 3. Prisma client: does it know about address + phone?
  try {
    const entities = await db.entity.findMany({
      select: { id: true, name: true, address: true, phone: true, logo: true },
      take: 5,
    });
    out.steps.push({
      step: 'Prisma client query',
      count: entities.length,
      hasAddressField: entities.length > 0 ? 'address' in entities[0] : false,
      hasPhoneField: entities.length > 0 ? 'phone' in entities[0] : false,
      hasLogoField: entities.length > 0 ? 'logo' in entities[0] : false,
      sample: entities[0],
    });
  } catch (e: any) {
    out.steps.push({ step: 'Prisma client query', error: e.message });
  }

  return NextResponse.json(out);
}
