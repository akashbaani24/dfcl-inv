#!/usr/bin/env node
/**
 * Upload DEWS stock data from Excel to production Turso database.
 * 
 * Steps:
 * 1. Create "Dynasty Furnishings Centre Ltd (DEWS)" entity (if not exists)
 * 2. Read Stock sheet from Excel — 699 rows with Barcode, Item Code, Current
 * 3. For each row:
 *    a. Find existing Item by barcode (or itemCode as fallback)
 *    b. If not found, create new Item
 *    c. Create/update Stock entry linking item → DEWS entity
 * 4. Report results
 */

const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const TURSO_URL = 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ';
const XLSX_PATH = '/home/z/my-project/upload/DEWS (1).xlsx';
const ENTITY_NAME = 'Dynasty Furnishings Centre Ltd (DEWS)';

function generateId() {
  return 'c' + crypto.randomBytes(12).toString('hex');
}

async function main() {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  
  // 1. Create or find DEWS entity
  let entityId;
  const entResult = await client.execute({
    sql: "SELECT id FROM Entity WHERE name = ?",
    args: [ENTITY_NAME]
  });
  
  if (entResult.rows.length > 0) {
    entityId = entResult.rows[0].id;
    console.log(`Entity already exists: ${ENTITY_NAME} (${entityId})`);
  } else {
    entityId = generateId();
    const now = new Date().toISOString();
    await client.execute({
      sql: "INSERT INTO Entity (id, name, description, entityType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [entityId, ENTITY_NAME, 'Dynasty Furnishings Centre Ltd', 'outlet', now, now]
    });
    console.log(`Created new entity: ${ENTITY_NAME} (${entityId})`);
  }
  
  // 2. Read Excel
  console.log(`\nReading Excel: ${XLSX_PATH}`);
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheet = workbook.Sheets['Stock'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Skip header row, process data
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
  
  console.log(`Read ${stockData.length} stock entries from Excel`);
  
  // 3. Process each row
  let itemsMatched = 0;
  let itemsCreated = 0;
  let stockCreated = 0;
  let stockUpdated = 0;
  
  for (let i = 0; i < stockData.length; i++) {
    const { barcode, itemCode, qty } = stockData[i];
    
    if (i % 100 === 0) {
      console.log(`  Processing row ${i + 1}/${stockData.length}...`);
    }
    
    // a. Find item by barcode
    let itemResult = await client.execute({
      sql: "SELECT id FROM Item WHERE barcode = ?",
      args: [barcode]
    });
    
    let itemId;
    
    if (itemResult.rows.length > 0) {
      itemId = itemResult.rows[0].id;
      itemsMatched++;
      // Update barcode if missing
      await client.execute({
        sql: "UPDATE Item SET barcode = ? WHERE id = ? AND (barcode IS NULL OR barcode = '')",
        args: [barcode, itemId]
      });
    } else if (itemCode) {
      // b. Try by itemCode
      itemResult = await client.execute({
        sql: "SELECT id FROM Item WHERE itemCode = ?",
        args: [itemCode]
      });
      
      if (itemResult.rows.length > 0) {
        itemId = itemResult.rows[0].id;
        itemsMatched++;
        // Also update barcode
        await client.execute({
          sql: "UPDATE Item SET barcode = ? WHERE id = ?",
          args: [barcode, itemId]
        });
      } else {
        // c. Create new Item
        itemId = generateId();
        const now = new Date().toISOString();
        await client.execute({
          sql: `INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', itemCode || barcode, 0, 'PCS', barcode, itemCode, now, now]
        });
        itemsCreated++;
      }
    } else {
      // No itemCode, create with barcode as name
      itemId = generateId();
      const now = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', barcode, 0, 'PCS', barcode, null, now, now]
      });
      itemsCreated++;
    }
    
    // d. Create or update Stock
    const stockResult = await client.execute({
      sql: "SELECT id, quantity FROM Stock WHERE itemId = ? AND entityId = ?",
      args: [itemId, entityId]
    });
    
    if (stockResult.rows.length > 0) {
      await client.execute({
        sql: "UPDATE Stock SET quantity = ? WHERE id = ?",
        args: [qty, stockResult.rows[0].id]
      });
      stockUpdated++;
    } else {
      const stockId = generateId();
      await client.execute({
        sql: "INSERT INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)",
        args: [stockId, itemId, entityId, qty]
      });
      stockCreated++;
    }
  }
  
  // 4. Report
  console.log(`\n${'='.repeat(60)}`);
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(60));
  console.log(`Entity: ${ENTITY_NAME} (${entityId})`);
  console.log(`Total rows processed: ${stockData.length}`);
  console.log(`Items matched (existing): ${itemsMatched}`);
  console.log(`Items created (new): ${itemsCreated}`);
  console.log(`Stock entries created: ${stockCreated}`);
  console.log(`Stock entries updated: ${stockUpdated}`);
  
  // Verify
  const verifyStock = await client.execute({
    sql: "SELECT COUNT(*) as c FROM Stock WHERE entityId = ?",
    args: [entityId]
  });
  const verifyQty = await client.execute({
    sql: "SELECT SUM(quantity) as total FROM Stock WHERE entityId = ?",
    args: [entityId]
  });
  console.log(`\nVerification:`);
  console.log(`  Total stock entries for DEWS: ${verifyStock.rows[0].c}`);
  console.log(`  Total quantity: ${verifyQty.rows[0].total}`);
  
  client.close();
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
