const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:/home/z/my-project/db/custom.db' });
(async () => {
  try {
    // Find items matching the pattern in the screenshot
    const r1 = await client.execute("SELECT id, itemName, barcode, createdAt, createdBy FROM Item WHERE itemName LIKE '720-500%' ORDER BY itemName LIMIT 30");
    console.log('Items matching "720-500%" pattern:');
    for (const row of r1.rows) {
      console.log(`  ${row.itemName} | barcode: ${row.barcode} | created: ${row.createdAt} | by: ${row.createdBy}`);
    }
    console.log(`Total: ${r1.rows.length}`);
    console.log();
    // Count all
    const r2 = await client.execute("SELECT COUNT(*) as cnt FROM Item WHERE itemName LIKE '720-500%'");
    console.log(`Total 720-500* items: ${r2.rows[0].cnt}`);
    console.log();
    // Show a histogram of who created them
    const r3 = await client.execute("SELECT createdBy, COUNT(*) as cnt, MIN(createdAt) as first, MAX(createdAt) as last FROM Item WHERE itemName LIKE '720-500%' GROUP BY createdBy");
    console.log('Created by:');
    for (const row of r3.rows) {
      console.log(`  ${row.createdBy}: ${row.cnt} items (first: ${row.first}, last: ${row.last})`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
