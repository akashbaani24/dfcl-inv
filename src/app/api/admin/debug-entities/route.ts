import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// GET /api/admin/debug-entities?token=DFCL_RESCUE_2026
//
// Emergency debug endpoint — does NOT require login.
// Returns the raw Entity table state + any error messages.
// Used to diagnose "No Entity Available" issues on production.

const HARDCODED_RESCUE_TOKEN = 'DFCL_RESCUE_2026';

export async function GET(request: NextRequest) {
  // Auth via token
  const token = request.nextUrl.searchParams.get('token');
  const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    return NextResponse.json({
      error: 'TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing on the server',
      tursoUrlPresent: !!tursoUrl,
      tursoTokenPresent: !!tursoToken,
    }, { status: 500 });
  }

  const out: Record<string, unknown> = {
    tursoUrl: tursoUrl.slice(0, 40) + '...',
    steps: [] as Array<{ step: string; ok: boolean; result?: unknown; error?: string }>,
  };

  try {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });

    // Step 1: SELECT 1 — basic connectivity
    try {
      const r = await client.execute('SELECT 1 as ok');
      out.steps.push({ step: 'SELECT 1', ok: true, result: r.rows[0] });
    } catch (e) {
      out.steps.push({ step: 'SELECT 1', ok: false, error: String(e) });
    }

    // Step 2: Get Entity table schema
    try {
      const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Entity'");
      out.steps.push({ step: 'Entity table schema', ok: true, result: r.rows[0]?.sql ?? 'NOT FOUND' });
    } catch (e) {
      out.steps.push({ step: 'Entity table schema', ok: false, error: String(e) });
    }

    // Step 3: Count entities
    try {
      const r = await client.execute('SELECT COUNT(*) as cnt FROM Entity');
      out.steps.push({ step: 'Count entities', ok: true, result: r.rows[0] });
    } catch (e) {
      out.steps.push({ step: 'Count entities', ok: false, error: String(e) });
    }

    // Step 4: Select first 20 entities — this is the exact query Prisma runs
    try {
      const r = await client.execute(
        "SELECT id, name, description, entityType, logo, createdAt, updatedAt FROM Entity ORDER BY name ASC"
      );
      out.steps.push({
        step: 'Select entities (full column list — same as Prisma)',
        ok: true,
        result: {
          rowCount: r.rows.length,
          firstFew: r.rows.slice(0, 5).map((row: any) => ({ id: row.id, name: row.name, entityType: row.entityType, hasLogo: !!row.logo })),
        }
      });
    } catch (e) {
      out.steps.push({ step: 'Select entities (full column list)', ok: false, error: String(e) });
    }

    // Step 5: Select entities WITHOUT logo column — fallback test
    try {
      const r = await client.execute(
        "SELECT id, name, description, entityType, createdAt, updatedAt FROM Entity ORDER BY name ASC"
      );
      out.steps.push({
        step: 'Select entities (WITHOUT logo column)',
        ok: true,
        result: {
          rowCount: r.rows.length,
          firstFew: r.rows.slice(0, 5).map((row: any) => ({ id: row.id, name: row.name, entityType: row.entityType })),
        }
      });
    } catch (e) {
      out.steps.push({ step: 'Select entities (WITHOUT logo column)', ok: false, error: String(e) });
    }

    // Step 6: Count items + salesOrders + users (sanity check that data exists in other tables)
    try {
      const itemCount = await client.execute('SELECT COUNT(*) as cnt FROM Item');
      const stockCount = await client.execute('SELECT COUNT(*) as cnt FROM Stock');
      const userCount = await client.execute('SELECT COUNT(*) as cnt FROM User');
      const soCount = await client.execute('SELECT COUNT(*) as cnt FROM SalesOrder');
      out.steps.push({
        step: 'Sanity check — other table counts',
        ok: true,
        result: {
          items: itemCount.rows[0].cnt,
          stock: stockCount.rows[0].cnt,
          users: userCount.rows[0].cnt,
          salesOrders: soCount.rows[0].cnt,
        }
      });
    } catch (e) {
      out.steps.push({ step: 'Sanity check — other table counts', ok: false, error: String(e) });
    }

  } catch (err) {
    out.fatalError = String(err);
  }

  return NextResponse.json(out, { status: 200 });
}
