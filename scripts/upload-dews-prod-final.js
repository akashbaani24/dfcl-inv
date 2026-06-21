const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const TURSO_URL = 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ';
const ENTITY_ID = 'cmqkiq8aj000cl404l2rnndyq';
const XLSX_PATH = '/home/z/my-project/upload/DEWS (1).xlsx';

function genId() { return 'c' + crypto.randomBytes(12).toString('hex'); }

async function main() {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // Read Excel
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets['Stock'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const stockData = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[2]) continue;
    let barcode = String(row[0]).trim();
    let itemCode = row[1] ? String(row[1]).trim() : null;
    let qty = parseFloat(row[2]);
    if (isNaN(qty) || qty <= 0) continue;
    qty = Math.round(qty);
    stockData.push({ barcode, itemCode, qty });
  }
  console.log('Total stock rows to upload:', stockData.length);

  let matched = 0, created = 0, stockNew = 0;
  let batch = [];

  for (let i = 0; i < stockData.length; i++) {
    const { barcode, itemCode, qty } = stockData[i];
    if (i % 50 === 0) console.log(`Processing ${i + 1}/${stockData.length}...`);

    // Find item by barcode
    let r = await client.execute({ sql: "SELECT id FROM Item WHERE barcode = ?", args: [barcode] });
    let itemId;

    if (r.rows.length > 0) {
      itemId = r.rows[0].id;
      matched++;
    } else if (itemCode) {
      r = await client.execute({ sql: "SELECT id FROM Item WHERE itemCode = ?", args: [itemCode] });
      if (r.rows.length > 0) {
        itemId = r.rows[0].id;
        matched++;
        await client.execute({ sql: "UPDATE Item SET barcode = ? WHERE id = ?", args: [barcode, itemId] });
      } else {
        itemId = genId();
        const now = new Date().toISOString();
        await client.execute({
          sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', itemCode, 0, 'PCS', barcode, itemCode, now, now]
        });
        created++;
      }
    } else {
      itemId = genId();
      const now = new Date().toISOString();
      await client.execute({
        sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', barcode, 0, 'PCS', barcode, null, now, now]
      });
      created++;
    }

    // Create stock entry
    await client.execute({
      sql: "INSERT INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)",
      args: [genId(), itemId, ENTITY_ID, qty]
    });
    stockNew++;
  }

  console.log('\n=== UPLOAD COMPLETE ===');
  console.log('Items matched:', matched);
  console.log('Items created:', created);
  console.log('Stock entries created:', stockNew);

  const v = await client.execute({ sql: "SELECT COUNT(*) as c, SUM(quantity) as q FROM Stock WHERE entityId = ?", args: [ENTITY_ID] });
  console.log('DEWS stock entries:', v.rows[0].c);
  console.log('DEWS total quantity:', v.rows[0].q);
  client.close();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
