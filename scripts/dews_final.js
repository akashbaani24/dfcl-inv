const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const client = createClient({
  url: 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ',
});
const entityId = 'cmqkiq8aj000cl404l2rnndyq';
const gid = () => 'c' + crypto.randomBytes(12).toString('hex');

async function main() {
  const wb = XLSX.readFile('/home/z/my-project/upload/DEWS (1).xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Stock'], { header: 1 });
  const m = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[2]) continue;
    let bc = String(r[0]).trim(), ic = r[1] ? String(r[1]).trim() : null, q = Math.round(parseFloat(r[2]));
    if (isNaN(q) || q <= 0) continue;
    if (!m.has(bc) || q > m.get(bc).qty) m.set(bc, { itemCode: ic, qty: q });
  }
  const data = [...m.entries()].map(([b, v]) => ({ barcode: b, itemCode: v.itemCode, qty: v.qty }));
  console.log('Unique barcodes:', data.length);

  await client.execute({ sql: 'DELETE FROM Stock WHERE entityId = ?', args: [entityId] });
  console.log('Cleared');

  let mt = 0, cr = 0, st = 0, er = 0;
  for (let i = 0; i < data.length; i++) {
    const { barcode, itemCode, qty } = data[i];
    if (i % 100 === 0) console.log(i + 1 + '/' + data.length);
    try {
      let r = await client.execute({ sql: 'SELECT id FROM Item WHERE barcode = ?', args: [barcode] });
      let itemId;
      if (r.rows.length > 0) { itemId = r.rows[0].id; mt++; }
      else if (itemCode) {
        r = await client.execute({ sql: 'SELECT id FROM Item WHERE itemCode = ?', args: [itemCode] });
        if (r.rows.length > 0) { itemId = r.rows[0].id; mt++; await client.execute({ sql: 'UPDATE Item SET barcode = ? WHERE id = ?', args: [barcode, itemId] }); }
        else { itemId = gid(); const now = new Date().toISOString(); await client.execute({ sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', itemCode, 0, 'PCS', barcode, itemCode, now, now] }); cr++; }
      } else { itemId = gid(); const now = new Date().toISOString(); await client.execute({ sql: 'INSERT INTO Item (id, year, lcNo, "group", subGroup, itemName, price, uom, barcode, itemCode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [itemId, 'N/A', 'N/A', 'N/A', 'N/A', barcode, 0, 'PCS', barcode, null, now, now] }); cr++; }
      await client.execute({ sql: 'INSERT OR IGNORE INTO Stock (id, itemId, entityId, quantity) VALUES (?, ?, ?, ?)', args: [gid(), itemId, entityId, qty] }); st++;
    } catch(e) { er++; if (er <= 3) console.error('Row', i+1, e.message.substring(0, 60)); }
  }
  console.log('MATCHED:' + mt + ' CREATED:' + cr + ' STOCK:' + st + ' ERRORS:' + er);
  const v = await client.execute({ sql: 'SELECT COUNT(*) as c, SUM(quantity) as q FROM Stock WHERE entityId = ?', args: [entityId] });
  console.log('FINAL: ' + v.rows[0].c + ' entries, ' + v.rows[0].q + ' qty');
  client.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
