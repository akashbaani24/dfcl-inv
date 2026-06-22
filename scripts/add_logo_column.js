const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:/home/z/my-project/db/custom.db' });
(async () => {
  try {
    // Add logo column (idempotent — SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
    // so we catch the duplicate-column error)
    await client.execute("ALTER TABLE Entity ADD COLUMN logo TEXT");
    console.log('✓ Added logo column to Entity table');
  } catch (e) {
    if (String(e).includes('duplicate column')) {
      console.log('✓ logo column already exists — skipping');
    } else {
      console.error('Error:', e.message);
      process.exit(1);
    }
  }
  // Verify
  const r = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Entity'");
  console.log('New schema:', r.rows[0].sql);
  // Confirm entities still present
  const r2 = await client.execute('SELECT COUNT(*) as cnt FROM Entity');
  console.log('Entity count (should still be 8):', r2.rows[0].cnt);
})();
