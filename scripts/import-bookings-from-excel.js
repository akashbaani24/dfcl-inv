/**
 * Import bookings from Bookings_Report_2026-06-27.xlsx
 * 
 * Run: node scripts/import-bookings-from-excel.js
 * 
 * Groups rows by (Booking For + Customer + Date From + Date Till + Reason)
 * and creates one Booking per group with N BookingItems.
 */
const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');

// Entity code → full name map (same as stock upload script)
const ENTITY_CODE_MAP = {
  'DE':   'Dynasty Furnishings Centre Ltd. (Elephant Road Branch)',
  'DMB':  'Dynasty Furnishings Centre Ltd. (Elephant Road Branch)',
  'DU':   'Dynasty Furnishings Centre Ltd. (Uttara Branch)',
  'DM':   'Dynasty Furnishings Centre Ltd (Mirpur Branch)',
  'DS':   'Dynasty Furnishings Centre Ltd (Sylhet Branch)',
  'DC':   'Dynasty Furnishings Centre Ltd (Chattogram Branch)',
  'DCM':  'Dynasty Furnishings Centre Ltd (Cumilla Branch)',
  'DR':   'Dynasty Furnishings Centre Ltd (Rajshahi Branch)',
  'DK':   'Dynasty Furnishings Centre Ltd (Khulna Branch)',
  'DEWS': 'Dynasty Furnishings Centre Ltd (DEWS)',
  'WG':    'Weavers Furnishing Ltd (Gulshan Branch)',
  'WG-3F': 'Weavers Furnishing Ltd (Gulshan Branch)',
  'WU':    'Weavers Furnishing Ltd (Uttara Branch)',
  'WBRA':  'Weavers Furnishing Ltd (Bashundhara Branch)',
  'WC':    'Weavers Furnishing Ltd (Chattogram Branch)',
  'WS':    'Weavers Furnishing Ltd (Sylhet Branch)',
  'WE':    'Weavers Furnishing Ltd (Elephant Road Branch)',
  'CG':   'Curtain Gallery',
  'VC-1': 'Velvet Corner 1',
  'VC-2': 'Velvet Corner 2',
  'ME':   'Mousumi',
  'SE':   'Shoukhin',
  'CWH':  'Central Warehouse (Accessory Dept)',
  'CWH-Accessory': 'Central Warehouse (Accessory Dept)',
  'Admin': 'Head Office',
  'N/A': null, // skip
};

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function main() {
  if (!TURSO_URL || !TURSO_TOKEN) {
    console.error('❌ Need TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.');
    process.exit(1);
  }

  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // 1. Read Excel
  console.log('📊 Reading Excel...');
  const wb = XLSX.readFile('/home/z/my-project/upload/Bookings_Report_2026-06-27.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Bookings'], { defval: '', raw: false });
  console.log(`   Total rows: ${rows.length}`);

  // 2. Pre-load entities (by name, lowercased)
  const entResult = await client.execute('SELECT id, name FROM Entity');
  const entityByName = new Map();
  for (const r of entResult.rows) {
    entityByName.set(String(r.name).toLowerCase().trim(), r.id);
  }
  console.log(`   Loaded ${entityByName.size} entities from DB`);

  // 3. Pre-load items (by itemName, lowercased)
  const itemResult = await client.execute('SELECT id, itemName FROM Item');
  const itemByName = new Map();
  for (const r of itemResult.rows) {
    itemByName.set(String(r.itemName).toLowerCase().trim(), r.id);
  }
  console.log(`   Loaded ${itemByName.size} items from DB`);

  // 4. Pre-load customers (by name, lowercased)
  const custResult = await client.execute('SELECT id, name FROM Customer');
  const customerByName = new Map();
  for (const r of custResult.rows) {
    customerByName.set(String(r.name).toLowerCase().trim(), r.id);
  }
  console.log(`   Loaded ${customerByName.size} customers from DB`);

  // 5. Group rows by (Booking For + Customer + Date From + Date Till + Reason)
  const groups = new Map();
  for (const r of rows) {
    const key = `${r['Booking For']}|${r['Customer']}|${r['Date From']}|${r['Date Till']}|${r['Reason']}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  console.log(`   Booking groups: ${groups.size}`);

  // 6. Process each group
  let created = 0, skipped = 0, errors = 0;
  const errorList = [];

  for (const [key, groupRows] of groups) {
    const firstRow = groupRows[0];
    const forCode = String(firstRow['Booking For'] || '').trim();
    const customerName = String(firstRow['Customer'] || '').trim();
    const dateFrom = String(firstRow['Date From'] || '').trim();
    const dateTill = String(firstRow['Date Till'] || '').trim();
    const reason = String(firstRow['Reason'] || '').trim();

    // Resolve "Booking For" entity
    const forEntityName = ENTITY_CODE_MAP[forCode];
    if (!forEntityName) {
      skipped++;
      errorList.push(`Group "${forCode}/${customerName}": unknown Booking For code "${forCode}"`);
      continue;
    }
    const forEntityId = entityByName.get(forEntityName.toLowerCase());
    if (!forEntityId) {
      skipped++;
      errorList.push(`Group "${forCode}/${customerName}": entity "${forEntityName}" not found in DB`);
      continue;
    }

    // Resolve customer (create if doesn't exist)
    let customerId = customerByName.get(customerName.toLowerCase());
    if (!customerId && customerName && customerName !== 'Admin') {
      // Create customer
      const custId = 'c' + require('crypto').randomBytes(12).toString('hex');
      try {
        await client.execute({
          sql: 'INSERT INTO Customer (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
          args: [custId, customerName, new Date().toISOString(), new Date().toISOString()],
        });
        customerId = custId;
        customerByName.set(customerName.toLowerCase(), custId);
        console.log(`   + Created customer: ${customerName}`);
      } catch (e) {
        errorList.push(`Group "${forCode}/${customerName}": failed to create customer: ${e.message}`);
        skipped++;
        continue;
      }
    }

    // Generate booking number
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    const bookingNo = `BK-${dateStr}-${random}`;

    // Create booking
    const bookingId = 'c' + require('crypto').randomBytes(12).toString('hex');
    const bookingDate = new Date(dateFrom).toISOString();
    const tillDate = dateTill ? new Date(dateTill).toISOString() : null;

    try {
      await client.execute({
        sql: `INSERT INTO Booking (id, bookingNo, entityId, customerId, bookingDate, tillDate, status, reason, notes, createdBy, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [bookingId, bookingNo, forEntityId, customerId || null, bookingDate, tillDate,
               'confirmed', reason, `Imported from Excel. Employee: ${firstRow['Employee'] || 'N/A'}`,
               'script-import', new Date().toISOString(), new Date().toISOString()],
      });

      // Create booking items
      let itemsCreated = 0;
      for (const r of groupRows) {
        const itemName = String(r['Item Code'] || '').trim();
        const fromCode = String(r['Booking From'] || '').trim();
        const qty = parseInt(r['Qty']) || 0;

        // Resolve item
        const itemId = itemByName.get(itemName.toLowerCase());
        if (!itemId) {
          errorList.push(`  Booking ${bookingNo}: item "${itemName}" not found — skipped`);
          continue;
        }

        // Resolve "Booking From" entity
        const fromEntityName = ENTITY_CODE_MAP[fromCode];
        if (!fromEntityName) {
          errorList.push(`  Booking ${bookingNo}: unknown Booking From code "${fromCode}" — skipped`);
          continue;
        }
        const fromEntityId = entityByName.get(fromEntityName.toLowerCase());
        if (!fromEntityId) {
          errorList.push(`  Booking ${bookingNo}: fromEntity "${fromEntityName}" not found — skipped`);
          continue;
        }

        // Create booking item
        const biId = 'c' + require('crypto').randomBytes(12).toString('hex');
        await client.execute({
          sql: `INSERT INTO BookingItem (id, bookingId, itemId, fromEntityId, quantity) VALUES (?, ?, ?, ?, ?)`,
          args: [biId, bookingId, itemId, fromEntityId, qty],
        });
        itemsCreated++;
      }

      console.log(`  ✓ ${bookingNo}: ${forEntityName} / ${customerName} — ${itemsCreated} items`);
      created++;
    } catch (e) {
      errors++;
      errorList.push(`Group "${forCode}/${customerName}": failed to create booking: ${e.message}`);
    }
  }

  console.log('');
  console.log('============================================');
  console.log('BOOKING IMPORT COMPLETE');
  console.log('============================================');
  console.log(`Bookings created: ${created}`);
  console.log(`Groups skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  if (errorList.length > 0) {
    console.log('');
    console.log('Errors/warnings (first 15):');
    for (const e of errorList.slice(0, 15)) {
      console.log(`  ${e}`);
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
