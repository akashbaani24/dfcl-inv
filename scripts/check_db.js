const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:/home/z/my-project/db/custom.db' });
(async () => {
  try {
    const r1 = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Entity'");
    console.log('Entity table exists:', r1.rows.length > 0);
    if (r1.rows.length > 0) {
      // Get schema
      const r2 = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Entity'");
      console.log('Schema:', r2.rows[0].sql);
      // Count rows
      const r3 = await client.execute('SELECT COUNT(*) as cnt FROM Entity');
      console.log('Row count:', r3.rows[0].cnt);
      // Show all entities (without logo column since it doesn't exist)
      const r4 = await client.execute('SELECT id, name, entityType, createdAt FROM Entity LIMIT 20');
      console.log('Entities:', JSON.stringify(r4.rows, null, 2));
      // Check Item count too
      try {
        const r5 = await client.execute('SELECT COUNT(*) as cnt FROM Item');
        console.log('Item count:', r5.rows[0].cnt);
        const r6 = await client.execute('SELECT COUNT(*) as cnt FROM SalesOrder');
        console.log('SalesOrder count:', r6.rows[0].cnt);
        const r7 = await client.execute('SELECT COUNT(*) as cnt FROM User');
        console.log('User count:', r7.rows[0].cnt);
        const r8 = await client.execute('SELECT COUNT(*) as cnt FROM Stock');
        console.log('Stock count:', r8.rows[0].cnt);
      } catch (e) {
        console.log('Skip count queries:', e.message);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
