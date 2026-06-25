import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// GET /api/admin/investigate-items?token=DFCL_RESCUE_2026
// Investigates items with auto-appended number suffixes (e.g. 720-500-D28).
// Returns: distinct base names, sample variations, creation patterns.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expected = process.env.MIGRATION_RESCUE_TOKEN || 'DFCL_RESCUE_2026';
  if (token !== expected) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    return NextResponse.json({ error: 'Turso not configured' }, { status: 500 });
  }

  const client = createClient({ url: tursoUrl, authToken: tursoToken });
  const out: any = { steps: [] };

  try {
    // Sample first 50
    const r1 = await client.execute(
      "SELECT id, itemName, barcode, itemCode, createdAt FROM Item WHERE itemName LIKE '720-500%' ORDER BY itemName LIMIT 50"
    );
    out.steps.push({ step: 'first_50', count: r1.rows.length, rows: r1.rows });

    // Total count
    const r2 = await client.execute(
      "SELECT COUNT(*) as cnt FROM Item WHERE itemName LIKE '720-500%'"
    );
    out.totalCount = r2.rows[0].cnt;

    // Histogram of base names (after stripping trailing digits)
    const r3 = await client.execute(
      `SELECT
         CASE
           WHEN itemName GLOB '*-[0-9][0-9]' THEN substr(itemName, 1, length(itemName) - 2)
           WHEN itemName GLOB '*-[0-9]' THEN substr(itemName, 1, length(itemName) - 1)
           ELSE itemName
         END as base_name,
         COUNT(*) as cnt,
         GROUP_CONCAT(itemName, ', ') as samples
       FROM Item
       WHERE itemName LIKE '720-500%'
       GROUP BY base_name
       ORDER BY cnt DESC, base_name ASC
       LIMIT 30`
    );
    out.steps.push({ step: 'base_name_histogram', top_bases: r3.rows });

    // Created by breakdown
    const r5 = await client.execute(
      `SELECT createdBy, COUNT(*) as cnt, MIN(createdAt) as first, MAX(createdAt) as last
       FROM Item WHERE itemName LIKE '720-500%' GROUP BY createdBy`
    );
    out.steps.push({ step: 'created_by', rows: r5.rows });

    // Check if there's a barcode or itemCode that matches the base name pattern
    const r6 = await client.execute(
      "SELECT id, itemName, barcode, itemCode FROM Item WHERE (barcode LIKE '720-500%' OR itemCode LIKE '720-500%') ORDER BY createdAt DESC LIMIT 30"
    );
    out.steps.push({ step: 'barcodes_or_itemcodes_matching_720_500', count: r6.rows.length, rows: r6.rows });

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
