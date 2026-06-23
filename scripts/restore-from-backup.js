#!/usr/bin/env node
/**
 * Restore production backup into local SQLite DB.
 *
 * Usage:
 *   node scripts/restore-from-backup.js download/production-backup.json
 *
 * What it does:
 *   1. Reads the backup JSON (downloaded from /api/cron/backup?action=download&id=xxx)
 *   2. Wipes the local SQLite DB at db/custom.db (after a confirmation prompt)
 *   3. Recreates the schema via Prisma
 *   4. Inserts every row from the backup into the appropriate table
 *   5. Verifies row counts at the end
 *
 * After this, local `npm run dev` will start with all the production data:
 *   - 8 users (admin/admin123 still works since admin's password hash is in backup)
 *   - 31 entities
 *   - 22,276 items
 *   - 695 stock entries
 *   - Sales orders, deliveries, bookings, etc.
 *
 * ⚠️ This OVERWRITES local data. Run only when you want a fresh copy of prod.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const BACKUP_FILE = process.argv[2] || 'download/production-backup.json';
const DB_PATH = path.join(__dirname, '..', 'db', 'custom.db');

// Prisma model name → table name mapping
// (most Prisma models just become TitleCase table names; verify against schema.prisma)
const TABLE_NAMES = [
  'User', 'Entity', 'Item', 'Stock', 'Group', 'SubGroup',
  'Supplier', 'Customer', 'Employee', 'Tailor', 'MakingInfo', 'UoM',
  'BookingReason', 'NewsTicker', 'AccountsCategory',
  'Purchase', 'PurchaseItem', 'SupplierPayment',
  'SalesOrder', 'SalesOrderItem', 'SalesMakingEntry', 'SalesPayment',
  'SalesReturn', 'Booking', 'BookingItem',
  'Transfer', 'Receive', 'ItemAdjustment',
  'Incentive', 'IncentiveFormula', 'IncentiveFormulaRange', 'IncentiveFormulaItem',
  'TailorPayment', 'Delivery', 'DeliveryItem',
  'AccountsEntry', 'ChatMessage',
];

// Insert order matters for foreign keys (parent before child)
const INSERT_ORDER = [
  'User',
  'Entity',
  'Group',
  'SubGroup',
  'UoM',
  'Supplier',
  'Customer',
  'Employee',
  'Tailor',
  'MakingInfo',
  'BookingReason',
  'NewsTicker',
  'AccountsCategory',
  'Item',
  'Stock',
  'Purchase',
  'PurchaseItem',
  'SupplierPayment',
  'SalesOrder',
  'SalesOrderItem',
  'SalesMakingEntry',
  'SalesPayment',
  'SalesReturn',
  'Booking',
  'BookingItem',
  'Transfer',
  'Receive',
  'ItemAdjustment',
  'Incentive',
  'IncentiveFormula',
  'IncentiveFormulaRange',
  'IncentiveFormulaItem',
  'TailorPayment',
  'Delivery',
  'DeliveryItem',
  'AccountsEntry',
  'ChatMessage',
];

function tableExists(client, tableName) {
  return client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
  ).then(r => r.rows.length > 0);
}

function getColumns(client, tableName) {
  return client.execute(`PRAGMA table_info("${tableName}")`).then(r =>
    r.rows.map(row => row.name)
  );
}

function escapeValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') {
    // Date objects, arrays, plain objects → JSON string
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  }
  // string
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`Backup file not found: ${BACKUP_FILE}`);
    process.exit(1);
  }

  console.log(`Reading backup: ${BACKUP_FILE}`);
  const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const backup = JSON.parse(raw);
  console.log(`Backup meta:`, backup._meta);
  console.log('');

  // ★ Auto-fix .env to use the correct absolute path for this machine.
  //    The .env shipped in the zip has a path that only works on the build
  //    machine. We rewrite it to point to <project_root>/db/custom.db.
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const dbAbsPath = path.join(projectRoot, 'db', 'custom.db');
  const dbDir = path.join(projectRoot, 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const envContent = `DATABASE_URL=file:${dbAbsPath}\nPRISMA_DATABASE_URL=file:${dbAbsPath}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log(`Updated .env with local DB path: ${dbAbsPath}`);
  console.log('');

  // Confirm overwrite
  if (!process.env.YES_OVERWRITE) {
    console.log(`⚠️  This will WIPE the local DB at: ${DB_PATH}`);
    console.log(`    and restore ${backup._meta.tableCount} tables from the backup.`);
    console.log(`    Re-run with YES_OVERWRITE=1 to skip this prompt.`);
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('Continue? (yes/no): ', resolve));
    rl.close();
    if (answer.toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Backup current local DB (just in case)
  if (fs.existsSync(DB_PATH)) {
    const backupPath = DB_PATH + '.pre-restore-' + Date.now();
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Backed up old local DB to: ${backupPath}`);
  }

  const client = createClient({ url: `file:${DB_PATH}` });

  // Wipe all existing tables (so we get a clean slate)
  console.log('');
  console.log('Dropping existing tables...');
  for (const t of TABLE_NAMES) {
    try { await client.execute(`DROP TABLE IF EXISTS "${t}"`); } catch {}
  }
  // Also drop the Backup table (created by /api/cron/backup) and other side tables
  try { await client.execute(`DROP TABLE IF EXISTS "Backup"`); } catch {}
  try { await client.execute(`DROP TABLE IF EXISTS "_prisma_migrations"`); } catch {}

  // Use Prisma to recreate the schema
  console.log('');
  console.log('Recreating schema via prisma db push...');
  const { execSync } = require('child_process');
  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  } catch (e) {
    console.error('prisma db push failed. Trying alternative...');
    // Fallback: just create with prisma db push without force-reset
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  }

  // Insert data table-by-table in dependency order
  console.log('');
  console.log('Inserting data from backup...');
  let totalInserted = 0;
  for (const tableName of INSERT_ORDER) {
    const rows = backup[tableName];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log(`  ${tableName}: 0 rows (skipped)`);
      continue;
    }

    // Make sure table exists in the local schema
    const exists = await tableExists(client, tableName);
    if (!exists) {
      console.log(`  ${tableName}: TABLE MISSING in local schema (skipped ${rows.length} rows)`);
      continue;
    }

    // Get the actual columns present in this table
    const columns = await getColumns(client, tableName);

    // Insert each row
    let inserted = 0;
    let errors = 0;
    for (const row of rows) {
      // Only insert columns that exist in the table AND in the row
      const cols = columns.filter(c => c in row && c !== 'id' || (c === 'id' && row.id));
      // Actually include id too — backup rows preserve their cuid() ids
      const insertCols = columns.filter(c => c in row);
      if (insertCols.length === 0) {
        errors++;
        continue;
      }
      const values = insertCols.map(c => escapeValue(row[c]));
      const sql = `INSERT OR IGNORE INTO "${tableName}" (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`;
      try {
        await client.execute(sql);
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 3) {
          console.error(`  ${tableName}: insert error: ${e.message}`);
        }
      }
    }
    console.log(`  ${tableName}: ${inserted}/${rows.length} inserted${errors ? ` (${errors} errors)` : ''}`);
    totalInserted += inserted;
  }

  console.log('');
  console.log(`✅ Total rows inserted: ${totalInserted}`);
  console.log('');

  // Verify counts
  console.log('Verification — row counts per table:');
  for (const tableName of INSERT_ORDER) {
    const exists = await tableExists(client, tableName);
    if (!exists) continue;
    try {
      const r = await client.execute(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
      const expected = backup[tableName]?.length || 0;
      const got = r.rows[0].cnt;
      const mark = (Number(got) === Number(expected)) ? '✓' : '⚠';
      console.log(`  ${mark} ${tableName}: ${got} (expected ${expected})`);
    } catch (e) {
      console.log(`  ✗ ${tableName}: ${e.message}`);
    }
  }

  console.log('');
  console.log('🎉 Restore complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. npx prisma generate    # refresh Prisma client');
  console.log('  2. npm run dev            # start the app');
  console.log('  3. Open http://localhost:3000');
  console.log('  4. Login with admin / admin123 (same password as production)');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
