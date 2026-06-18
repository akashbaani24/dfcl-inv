import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// POST /api/admin/migrate-schema?token=RESCUE_TOKEN
//
// ★ Emergency migration endpoint — does NOT require login.
//   Needed because login itself depends on the new schema columns.
//
// Uses libsql client directly (NOT prisma) to run ALTER TABLE statements.
// This avoids the need for the prisma binary which isn't available in Vercel's
// serverless runtime.
//
// Auth: ?token=xxx query param (DFCL_RESCUE_2026 default, or MIGRATION_RESCUE_TOKEN env var)

const HARDCODED_RESCUE_TOKEN = 'DFCL_RESCUE_2026';

// All migrations to apply, in order. Each is idempotent (uses IF NOT EXISTS pattern
// by catching "duplicate column" errors).
const MIGRATIONS: { id: string; sql: string; description: string }[] = [
  // v44: Item barcode + itemCode
  {
    id: '2026_06_18_item_barcode',
    sql: 'ALTER TABLE Item ADD COLUMN barcode TEXT',
    description: 'Add barcode column to Item',
  },
  {
    id: '2026_06_18_item_itemcode',
    sql: 'ALTER TABLE Item ADD COLUMN itemCode TEXT',
    description: 'Add itemCode column to Item',
  },
  // v45: UserMenuAccess permission flags
  {
    id: '2026_06_18_menu_canCreate',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canCreate BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canCreate column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canEdit',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canEdit BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canEdit column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canDelete',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canDelete BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canDelete column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canUpload',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canUpload BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canUpload column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canExport',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canExport BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canExport column to UserMenuAccess',
  },
  // v45: UserMasterDataAccess permission flags
  {
    id: '2026_06_18_master_canCreate',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canCreate BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canCreate column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canEdit',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canEdit BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canEdit column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canDelete',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canDelete BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canDelete column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canUpload',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canUpload BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canUpload column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canExport',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canExport BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canExport column to UserMasterDataAccess',
  },
];

export async function POST(request: NextRequest) {
  try {
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
        error: 'TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set on Vercel.',
        hasTursoUrl: !!tursoUrl,
        hasTursoToken: !!tursoToken,
      }, { status: 500 });
    }

    // Connect to Turso directly via libsql
    const client = createClient({ url: tursoUrl, authToken: tursoToken });

    const results: { id: string; description: string; status: 'applied' | 'already-exists' | 'failed'; error?: string }[] = [];

    for (const migration of MIGRATIONS) {
      try {
        await client.execute(migration.sql);
        results.push({ ...migration, status: 'applied' });
      } catch (err: any) {
        const msg = err.message || String(err);
        // SQLite returns "duplicate column name" if the column already exists
        if (/duplicate column name|already exists/i.test(msg)) {
          results.push({ ...migration, status: 'already-exists' });
        } else {
          results.push({ ...migration, status: 'failed', error: msg.slice(0, 200) });
        }
      }
    }

    // Also try to create the unique index on Item.barcode (best-effort, may already exist)
    try {
      await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS `Item_barcode_key` ON `Item`(`barcode`)');
      results.push({ id: 'index_item_barcode', description: 'Unique index on Item.barcode', status: 'applied' });
    } catch (err: any) {
      results.push({ id: 'index_item_barcode', description: 'Unique index on Item.barcode', status: 'failed', error: (err.message || '').slice(0, 200) });
    }

    // Try to create index on Item.itemCode
    try {
      await client.execute('CREATE INDEX IF NOT EXISTS `Item_itemCode_idx` ON `Item`(`itemCode`)');
      results.push({ id: 'index_item_itemCode', description: 'Index on Item.itemCode', status: 'applied' });
    } catch (err: any) {
      results.push({ id: 'index_item_itemCode', description: 'Index on Item.itemCode', status: 'failed', error: (err.message || '').slice(0, 200) });
    }

    const appliedCount = results.filter(r => r.status === 'applied').length;
    const alreadyCount = results.filter(r => r.status === 'already-exists').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: failedCount === 0,
      summary: {
        applied: appliedCount,
        alreadyExists: alreadyCount,
        failed: failedCount,
        total: results.length,
      },
      results,
      message: failedCount === 0
        ? '✅ Migration complete. Login should work now.'
        : `⚠️  Migration completed with ${failedCount} failures. See results for details.`,
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
    migrationCount: MIGRATIONS.length,
    message: `POST to this endpoint (with same token) to run ${MIGRATIONS.length} migrations against Turso.`,
  });
}
