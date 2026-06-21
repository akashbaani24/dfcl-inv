const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');

const TURSO_URL = 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ';
const ENTITY_ID = 'cmqkiq8aj000cl404l2rnndyq';
const XLSX_PATH = '/home/z/my-project/upload/DEWS (1).xlsx';
const LOG_PATH = '/tmp/dews-upload-final.log';

function genId() { return 'c' + crypto.randomBytes(12).toString('hex'); }
function log(msg) { console.log(msg); fs.appendFileSync(LOG_PATH, msg + '\n'); }

async function main() {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  fs.writeFileSync(LOG_PATH, '');

  // Step 1: Read Excel — deduplicate by barcode (keep highest qty if duplicate)
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets['Stock'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const excelMap = new Map(); // barcode → {itemCode, qty}
  let totalRows = 0, skippedZero = 0, duplicates = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[2]) continue;
    totalRows++;

    let barcode = String(row[0]).trim();
    let itemCode = row[1] ? String(row[1]).trim() : null;
    let qty = parseFloat(row[2]);

    if (isNaN(qty) || qty <= 0) { skippedZero++; continue; }
    qty = Math.round(qty);

    if (excelMap.has(barcode)) {
      // Duplicate barcode — keep the one with higher qty
      duplicates++;
      const existing = excelMap.get(barcode);
      if (qty > existing.qty) {
        excelMap.set(barcode, { itemCode, qty });
      }
    } else {
      excelMap.set(barcode, { itemCode, qty });
    }
  }

  const stockData = Array.from(excelMap.entries()).map(([barcode, v]) => ({
    barcode, itemCode: v.itemCode, qty: v.qty
  }));

  log(`=== EXCEL ANALYSIS ===`);
  log(`Total rows: ${totalRows}`);
  log(`Skipped (zero/negative qty): ${skippedZero}`);
  log(`Duplicate barcodes (merged): ${duplicates}`);
  log(`Unique barcodes to upload: ${stockData.length}`);

  // Step 2: Delete ALL existing DEWS stock (clean slate — no duplicates)
  log(`\n=== CLEARING EXISTING STOCK ===`);
  const delResult = await client.execute({
    sql: 'DELETE FROM Stock WHERE entityId = ?',
    args: [ENTITY_ID]
  });
  log(`Deleted existing stock entries for DEWS`);

  // Step 3: Process each barcode
  log(`\n=== UPLOADING STOCK ===`);
  let matched = 0, created = 0, stockCreated = 0, errors = 0;

  for (let i = 0; i < stockData.length; i++) {
    const { barcode, itemCode, qty } = stockData[i];
    if (i % 50 === 0) log(`  Processing ${i + 1}/${stockData.length}...`);

    try {
      // a. Find existing Item by barcode
      let r = await client.execute({
        sql: "SELECT id FROM Item WHERE barcode = ?",
        args: [barcode]
      });
      let itemId;

      if (r.rows.length > 0) {
        itemId = r.rows[0].id;
        matched++;
      } else if (itemCode) {
        // b. Find by itemCode
        r = await client.execute({
          sql: "SELECT id FROM Item WHERE itemCode = ?",
          args: [itemCode]
        });
        if (r.rows.length > 0) {
          itemId = r.rows[0].id;
          matched++;
          // Update barcode on the existing item
          await client.execute({
            sql: "UPDATE Item SET barcode = ? WHERE id = ?",
            args: [barcode, itemId]
          });
        } else {
          // c. Create new Item in Item Information
          itemId = genId();
          const now = new Date().toISOString();
          await client.execute({
            sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', itemCode, 0, 'PCS', barcode, itemCode, now, now]
          });
          created++;
        }
      } else {
        // No itemCode — create item with barcode as name
        itemId = genId();
        const now = new Date().toISOString();
        await client.execute({
          sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', barcode, 0, 'PCS', barcode, null, now, now]
        });
        created++;
      }

      // d. Create Stock entry
      await client.execute({
        sql: "INSERT INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)",
        args: [genId(), itemId, ENTITY_ID, qty]
      });
      stockCreated++;
    } catch (e) {
      errors++;
      log(`  ERROR row ${i + 1} (barcode=${barcode}): ${e.message.substring(0, 80)}`);
    }
  }

  // Step 4: Report
  log(`\n${'='.repeat(60)}`);
  log('UPLOAD COMPLETE');
  log('='.repeat(60));
  log(`Entity: Dynasty Furnishings Centre Ltd (DEWS) (${ENTITY_ID})`);
  log(`Excel total rows: ${totalRows}`);
  log(`Excel unique barcodes: ${stockData.length}`);
  log(`Items matched (existing in DB): ${matched}`);
  log(`Items created (new in Item Information): ${created}`);
  log(`Stock entries created: ${stockCreated}`);
  log(`Errors: ${errors}`);

  // Verify
  const v = await client.execute({
    sql: "SELECT COUNT(*) as c, SUM(quantity) as q FROM Stock WHERE entityId = ?",
    args: [ENTITY_ID]
  });
  log(`\nVerification:`);
  log(`  DEWS stock entries: ${v.rows[0].c}`);
  log(`  DEWS total quantity: ${v.rows[0].q}`);

  client.close();
  process.exit(0);
}

main().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
