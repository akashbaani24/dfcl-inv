/**
 * Investigate the 720-500-D28, 720-500-C22, etc. items.
 * User says these number suffixes are NOT supposed to be there — system added them.
 *
 * This script:
 *   1. Queries production DB directly for items matching '720-500%'
 *   2. Tries to reverse-engineer the pattern: are A/B/C/D random? Are the numbers sequential?
 *   3. Checks if there are duplicate "base names" (without the 2-digit suffix)
 */
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || !token) {
  console.error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set in env');
  process.exit(1);
}

const client = createClient({ url, authToken: token });

(async () => {
  // 1. Sample 50 of these items, ordered
  const r1 = await client.execute(
    "SELECT id, itemName, barcode, itemCode, createdAt FROM Item WHERE itemName LIKE '720-500%' ORDER BY itemName LIMIT 50"
  );
  console.log('=== First 50 items matching "720-500%" ===');
  for (const row of r1.rows) {
    console.log(`  ${row.itemName} | barcode=${row.barcode} | itemCode=${row.itemCode} | created=${row.createdAt}`);
  }

  // 2. Count total
  const r2 = await client.execute(
    "SELECT COUNT(*) as cnt FROM Item WHERE itemName LIKE '720-500%'"
  );
  console.log(`\n=== Total items matching "720-500%": ${r2.rows[0].cnt} ===`);

  // 3. Try to identify the "base name" by stripping the trailing 2 digits
  //    Pattern: "720-500-D28" → base = "720-500-D"
  //             "720-500-C22" → base = "720-500-C"
  //             "720-500"     → base = "720-500"
  //    If a base name appears multiple times, the user is right — the system
  //    auto-appended numbers to make duplicates unique.
  console.log('\n=== Histogram of base names (after stripping trailing digits) ===');
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
     LIMIT 20`
  );
  for (const row of r3.rows) {
    console.log(`  "${row.base_name}" × ${row.cnt}`);
    console.log(`    samples: ${row.samples.substring(0, 200)}${row.samples.length > 200 ? '...' : ''}`);
  }

  // 4. Show distinct barcodes for the same base name — if barcodes are unique
  //    but itemNames only differ by the trailing digits, the upload script DID
  //    auto-generate names from barcodes or similar.
  console.log('\n=== For the most common base name, show all variations ===');
  if (r3.rows.length > 0) {
    const baseName = r3.rows[0].base_name;
    const r4 = await client.execute({
      sql: `SELECT itemName, barcode, itemCode, createdAt FROM Item WHERE itemName LIKE ? ORDER BY itemName`,
      args: [baseName + '%'],
    });
    console.log(`Base name "${baseName}" — ${r4.rows.length} variants:`);
    for (const row of r4.rows) {
      console.log(`  itemName="${row.itemName}" | barcode="${row.barcode}" | itemCode="${row.itemCode}"`);
    }
  }

  // 5. Check the createdBy for these items
  console.log('\n=== Created by (user IDs) ===');
  const r5 = await client.execute(
    `SELECT createdBy, COUNT(*) as cnt, MIN(createdAt) as first, MAX(createdAt) as last
     FROM Item WHERE itemName LIKE '720-500%' GROUP BY createdBy`
  );
  for (const row of r5.rows) {
    console.log(`  createdBy="${row.createdBy}" → ${row.cnt} items (first=${row.first}, last=${row.last})`);
  }

  // 6. Cross-check: are there barcodes like "720-500-D" without the digits?
  //    This would tell us the barcode IS the base name and the system appended a serial.
  console.log('\n=== Check: does any Item.barcode look like the base name (no trailing digits)? ===');
  const r6 = await client.execute(
    "SELECT id, itemName, barcode FROM Item WHERE barcode LIKE '720-500-%' AND barcode NOT GLOB '*[0-9][0-9]' LIMIT 10"
  );
  if (r6.rows.length > 0) {
    for (const row of r6.rows) {
      console.log(`  barcode="${row.barcode}" | itemName="${row.itemName}"`);
    }
  } else {
    console.log('  (no barcodes that match base pattern — barcode itself has digits)');
  }

  client.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
