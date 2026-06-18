import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// One-time endpoint to create Group & SubGroup tables on Turso
// Admin-only, can be deleted after first use
export async function GET() {
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
      return NextResponse.json({ error: 'Turso env vars not set' }, { status: 500 });
    }

    const c = createClient({ url: tursoUrl, authToken: tursoToken });
    const results: string[] = [];

    // Create Group table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Group" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Group_name_key" ON "Group"("name")');
      results.push('✓ Group table created');
    } catch (e) {
      results.push('✗ Group table: ' + String(e).slice(0, 100));
    }

    // Create SubGroup table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SubGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "groupId" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SubGroup_name_groupId_key" ON "SubGroup"("name", "groupId")');
      results.push('✓ SubGroup table created');
    } catch (e) {
      results.push('✗ SubGroup table: ' + String(e).slice(0, 100));
    }

    // Verify
    const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Group','SubGroup')");
    results.push('Tables now: ' + tables.rows.map(r => r.name).join(', '));

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
