// Quick debug script: query production Turso DB to check if batchId is being stored on transfers.
// Run with: node scripts/check-batch-id.js
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
  process.exit(1);
}

const client = createClient({ url, authToken: token });

async function main() {
  // 1. Check if batchId column exists on Transfer table
  console.log('=== Transfer table schema ===');
  try {
    const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Transfer'");
    console.log(r.rows[0]?.sql ?? 'Transfer table NOT FOUND');
  } catch (e) {
    console.error('Schema query failed:', e.message);
  }

  console.log('\n=== Last 10 transfers (check batchId column) ===');
  try {
    const r = await client.execute('SELECT id, itemId, barcode, batchId, status, createdAt FROM Transfer ORDER BY createdAt DESC LIMIT 10');
    for (const row of r.rows) {
      console.log(JSON.stringify(row));
    }
  } catch (e) {
    console.error('Transfer query failed:', e.message);
  }

  console.log('\n=== Transfers with batchId set ===');
  try {
    const r = await client.execute("SELECT batchId, COUNT(*) as count FROM Transfer WHERE batchId IS NOT NULL GROUP BY batchId");
    for (const row of r.rows) {
      console.log(JSON.stringify(row));
    }
    if (r.rows.length === 0) {
      console.log('NO transfers have batchId set!');
    }
  } catch (e) {
    console.error('batchId query failed:', e.message);
  }

  process.exit(0);
}

main();
