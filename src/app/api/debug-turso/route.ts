import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// Debug endpoint — actually tries to connect to Turso and run a query
export async function GET() {
  const logs: string[] = [];
  const startTime = Date.now();

  try {
    logs.push(`[${Date.now() - startTime}ms] Starting Turso debug`);

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    logs.push(`[${Date.now() - startTime}ms] TURSO_DATABASE_URL: ${url ? `present (${url.length} chars, starts with ${url.slice(0, 30)})` : 'MISSING'}`);
    logs.push(`[${Date.now() - startTime}ms] TURSO_AUTH_TOKEN: ${token ? `present (${token.length} chars)` : 'MISSING'}`);

    if (!url || !token) {
      return NextResponse.json({ success: false, logs, error: 'Missing Turso env vars' }, { status: 500 });
    }

    logs.push(`[${Date.now() - startTime}ms] Creating libsql client`);
    const client = createClient({ url, authToken: token });

    logs.push(`[${Date.now() - startTime}ms] Executing SELECT 1`);
    const r1 = await client.execute('SELECT 1 as ok');
    logs.push(`[${Date.now() - startTime}ms] SELECT 1 result: ${JSON.stringify(r1.rows[0])}`);

    logs.push(`[${Date.now() - startTime}ms] Counting users`);
    const r2 = await client.execute('SELECT COUNT(*) as cnt FROM User');
    logs.push(`[${Date.now() - startTime}ms] User count: ${r2.rows[0].cnt}`);

    logs.push(`[${Date.now() - startTime}ms] Fetching admin user`);
    const r3 = await client.execute("SELECT username, role FROM User WHERE username = 'admin'");
    logs.push(`[${Date.now() - startTime}ms] Admin user: ${JSON.stringify(r3.rows[0])}`);

    return NextResponse.json({
      success: true,
      logs,
      result: {
        userCount: r2.rows[0].cnt,
        adminUser: r3.rows[0],
      }
    }, { status: 200 });

  } catch (err) {
    logs.push(`[${Date.now() - startTime}ms] ERROR: ${String(err)}`);
    return NextResponse.json({
      success: false,
      logs,
      error: String(err),
      errorName: err instanceof Error ? err.name : 'Unknown',
    }, { status: 500 });
  }
}
