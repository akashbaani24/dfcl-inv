const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const client = createClient({
  url: 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ',
});
const entityId = 'cmqkiq8aj000cl404l2rnndyq';
const gid = () => 'c' + crypto.randomBytes(12).toString('hex');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // === STEP 1: Read Excel, deduplicate by barcode ===
  console.log('Reading Excel...');
  const wb = XLSX.readFile('/home/z/my-project/upload/DEWS (1).xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Stock'], { header: 1 });

  const excelMap = new Map();
  let totalRows = 0, zeroQty = 0, dupes = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[2]) continue;
    totalRows++;
    let bc = String(r[0]).trim();
    let ic = r[1] ? String(r[1]).trim() : null;
    let q = Math.round(parseFloat(r[2]));
    if (isNaN(q) || q <= 0) { zeroQty++; continue; }
    if (excelMap.has(bc)) { dupes++; if (q > excelMap.get(bc).qty) excelMap.set(bc, { itemCode: ic, qty: q }); }
    else excelMap.set(bc, { itemCode: ic, qty: q });
  }
  const stockData = [...excelMap.entries()].map(([b, v]) => ({ barcode: b, itemCode: v.itemCode, qty: v.qty }));
  console.log(`Excel: ${totalRows} rows, ${zeroQty} zero-qty skipped, ${dupes} duplicates merged, ${stockData.length} unique barcodes`);

  // === STEP 2: Get ALL existing items from DB (barcode → itemId) ===
  console.log('Fetching all existing items from DB...');
  const allItems = await client.execute({ sql: "SELECT id, barcode, itemCode FROM Item WHERE barcode IS NOT NULL AND barcode != ''", args: [] });
  console.log(`Found ${allItems.rows.length} items with barcodes in DB`);

  const dbByBarcode = new Map();
  const dbByItemCode = new Map();
  for (const row of allItems.rows) {
    if (row.barcode) dbByBarcode.set(row.barcode, row.id);
    if (row.itemCode) dbByItemCode.set(row.itemCode, row.id);
  }

  // === STEP 3: Categorize each Excel row ===
  //   - matched: item already exists in DB (by barcode or itemCode)
  //   - toCreate: item doesn't exist, need to create new Item first
  const matched = [];      // { itemId, qty }
  const toCreate = [];     // { barcode, itemCode, qty }

  for (const d of stockData) {
    if (dbByBarcode.has(d.barcode)) {
      matched.push({ itemId: dbByBarcode.get(d.barcode), qty: d.qty });
    } else if (d.itemCode && dbByItemCode.has(d.itemCode)) {
      // Matched by itemCode — need to update barcode on this item
      matched.push({ itemId: dbByItemCode.get(d.itemCode), qty: d.qty, updateBarcode: d.barcode });
    } else {
      toCreate.push(d);
    }
  }
  console.log(`Matched existing items: ${matched.length}`);
  console.log(`New items to create: ${toCreate.length}`);

  // === STEP 4: Delete ALL existing DEWS stock (clean slate) ===
  console.log('Clearing existing DEWS stock...');
  await client.execute({ sql: 'DELETE FROM Stock WHERE entityId = ?', args: [entityId] });
  console.log('Cleared.');

  // === STEP 5: Create new items in BATCHES of 50 ===
  let created = 0;
  const BATCH = 50;

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    const stmts = chunk.map(d => {
      const itemId = gid();
      const now = new Date().toISOString();
      return {
        sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', d.itemCode || d.barcode, 0, 'PCS', d.barcode, d.itemCode, now, now]
      };
    });
    try {
      await client.batch(stmts);
      created += chunk.length;
      console.log(`  Created items: ${created}/${toCreate.length}`);
    } catch(e) {
      console.error(`  Batch create error at ${i}: ${e.message.substring(0, 80)}`);
      // Fallback: create one by one
      for (const d of chunk) {
        try {
          const itemId = gid();
          const now = new Date().toISOString();
          await client.execute({
            sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', d.itemCode || d.barcode, 0, 'PCS', d.barcode, d.itemCode, now, now]
          });
          created++;
          // Also store the new itemId for stock creation
          dbByBarcode.set(d.barcode, itemId);
        } catch(e2) {
          console.error(`    Individual create error: ${e2.message.substring(0, 60)}`);
        }
      }
    }
    await sleep(200); // Small delay between batches
  }

  // === STEP 6: Update barcodes on items matched by itemCode ===
  const barcodeUpdates = matched.filter(m => m.updateBarcode);
  if (barcodeUpdates.length > 0) {
    console.log(`Updating barcodes on ${barcodeUpdates.length} items...`);
    for (let i = 0; i < barcodeUpdates.length; i += BATCH) {
      const chunk = barcodeUpdates.slice(i, i + BATCH);
      const stmts = chunk.map(m => ({
        sql: 'UPDATE Item SET barcode = ? WHERE id = ?',
        args: [m.updateBarcode, m.itemId]
      }));
      try { await client.batch(stmts); } catch(e) { console.error('Barcode update batch error:', e.message.substring(0, 60)); }
      await sleep(100);
    }
  }

  // === STEP 7: Create stock entries for MATCHED items in BATCHES ===
  console.log('Creating stock for matched items...');
  let stockCount = 0;
  for (let i = 0; i < matched.length; i += BATCH) {
    const chunk = matched.slice(i, i + BATCH);
    const stmts = chunk.map(m => ({
      sql: 'INSERT OR IGNORE INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)',
      args: [gid(), m.itemId, entityId, m.qty]
    }));
    try {
      await client.batch(stmts);
      stockCount += chunk.length;
    } catch(e) {
      console.error(`Stock batch error at ${i}: ${e.message.substring(0, 80)}`);
      // Fallback: one by one
      for (const m of chunk) {
        try { await client.execute({ sql: 'INSERT OR IGNORE INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)', args: [gid(), m.itemId, entityId, m.qty] }); stockCount++; }
        catch(e2) { console.error('  Individual stock error:', e2.message.substring(0, 60)); }
      }
    }
    await sleep(200);
  }
  console.log(`  Stock created for matched: ${stockCount}`);

  // === STEP 8: Create stock entries for NEW items ===
  console.log('Creating stock for new items...');
  let newStockCount = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    const stmts = chunk.map(d => ({
      sql: 'INSERT OR IGNORE INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)',
      args: [gid(), dbByBarcode.get(d.barcode), entityId, d.qty]
    })).filter(s => s.args[1]); // Only if we have a valid itemId

    if (stmts.length === 0) continue;
    try {
      await client.batch(stmts);
      newStockCount += stmts.length;
    } catch(e) {
      console.error(`New stock batch error at ${i}: ${e.message.substring(0, 80)}`);
      for (const d of chunk) {
        const itemId = dbByBarcode.get(d.barcode);
        if (!itemId) continue;
        try { await client.execute({ sql: 'INSERT OR IGNORE INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)', args: [gid(), itemId, entityId, d.qty] }); newStockCount++; }
        catch(e2) { console.error('  Individual error:', e2.message.substring(0, 60)); }
      }
    }
    await sleep(200);
  }
  console.log(`  Stock created for new items: ${newStockCount}`);

  // === STEP 9: Final verification ===
  const v = await client.execute({ sql: 'SELECT COUNT(*) as c, SUM(quantity) as q FROM Stock WHERE entityId = ?', args: [entityId] });
  console.log('\n========================================');
  console.log('UPLOAD COMPLETE');
  console.log('========================================');
  console.log(`Entity: Dynasty Furnishings Centre Ltd (DEWS)`);
  console.log(`Excel unique barcodes: ${stockData.length}`);
  console.log(`Items matched (existing): ${matched.length}`);
  console.log(`Items created (new): ${created}`);
  console.log(`Stock for matched items: ${stockCount}`);
  console.log(`Stock for new items: ${newStockCount}`);
  console.log(`Total stock entries: ${stockCount + newStockCount}`);
  console.log(`\nVerification:`);
  console.log(`  DEWS stock entries in DB: ${v.rows[0].c}`);
  console.log(`  DEWS total quantity: ${v.rows[0].q}`);

  client.close();
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
