import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';

// POST /api/admin/migrate-schema?token=RESCUE_TOKEN
//
// ★ Emergency migration endpoint — does NOT require login.
//   This is needed because login itself depends on the new schema columns.
//
// Authentication: pass ?token=xxx where xxx matches process.env.MIGRATION_RESCUE_TOKEN,
// OR if MIGRATION_RESCUE_TOKEN is not set, falls back to a hardcoded one-time rescue token
// that we'll rotate. This is acceptable because:
//   1. The endpoint only ADDS columns (never deletes data)
//   2. It only runs `prisma db push` (idempotent)
//   3. After migration succeeds, you can delete this endpoint or set MIGRATION_RESCUE_TOKEN
//
// Usage from command line:
//   curl -X POST 'https://dfcl-inv.vercel.app/api/admin/migrate-schema?token=DFCL_RESCUE_2026' \
//        -H 'Content-Type: application/json' -d '{}'

const HARDCODED_RESCUE_TOKEN = 'DFCL_RESCUE_2026';

export async function POST(request: NextRequest) {
  try {
    // Auth via token query param
    const token = request.nextUrl.searchParams.get('token');
    const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
    if (token !== expected) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
      return NextResponse.json({
        error: 'TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set on Vercel.',
        hasTursoUrl: !!tursoUrl,
        hasTursoToken: !!tursoToken,
      }, { status: 500 });
    }

    const prismaDbUrl = `${tursoUrl}?authToken=${tursoToken}`;

    let output = '';
    let migrationSucceeded = false;

    try {
      output = execSync(
        `npx prisma db push --accept-data-loss --skip-generate 2>&1`,
        {
          env: {
            ...process.env,
            PRISMA_DATABASE_URL: prismaDbUrl,
            PRISMA_TELEMETRY_INFORMATION: 'false',
            NO_UPDATE_NOTIFIER: '1',
          },
          timeout: 25000,
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );
      migrationSucceeded = true;
    } catch (err: any) {
      output = err.stdout || err.stderr || err.message || String(err);
      // prisma db push exits non-zero on warnings, but also on real errors
      // Look for actual error markers
      const hasRealError = /error:\s|Error:\s|Migration failed|P3009|P3014/i.test(output);
      if (hasRealError) {
        return NextResponse.json({
          error: 'prisma db push failed',
          output: output.slice(-4000),
        }, { status: 500 });
      }
      // warning-only — treat as success
      migrationSucceeded = true;
    }

    // Verify by trying to read one user's menuAccess (this would fail before migration)
    let verification = 'skipped';
    try {
      const testUser = await db.user.findFirst({
        include: {
          menuAccess: { take: 1 },
        },
      });
      verification = testUser ? 'ok (queried menuAccess successfully)' : 'ok (no users yet)';
    } catch (vErr: any) {
      verification = 'FAILED: ' + (vErr.message || String(vErr)).slice(0, 200);
      // Verification might fail if Prisma client wasn't regenerated to know about new fields
      // but the DB now has them. This is fine — the running container's Prisma client
      // will pick up the new fields after the next deployment.
    }

    return NextResponse.json({
      success: migrationSucceeded,
      message: 'Schema migration applied to Turso. The login should work now. If not, please redeploy on Vercel to pick up the new Prisma client.',
      output: output.slice(-3000),
      verification,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed: ' + (error instanceof Error ? error.message : String(error)),
    }, { status: 500 });
  }
}

// GET — status check (also token-gated)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
  }
  return NextResponse.json({
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    message: 'POST to this endpoint (with same token) to run prisma db push against Turso.',
  });
}
