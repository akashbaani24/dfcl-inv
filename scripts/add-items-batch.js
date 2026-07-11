// Script to add 61 new items to the production Turso database.
// Run with: node scripts/add-items-batch.js
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
  process.exit(1);
}

const client = createClient({ url, authToken: token });

// ★ All 61 items from the user's image
const items = [
  { itemName: 'Ribbon (81X69X3)', uom: 'CFT' },
  { itemName: 'Ribbon (81X69X2)', uom: 'CFT' },
  { itemName: 'Ribbon (81X69X4)', uom: 'CFT' },
  { itemName: 'Ribbon (81X69X5)', uom: 'CFT' },
  { itemName: 'Ribbon (81X69X7)', uom: 'CFT' },
  { itemName: 'Spring 8 Inch', uom: 'SQFT' },
  { itemName: 'Spring 6 Inch', uom: 'PCS' },
  { itemName: 'Felt (81X69X0.50)', uom: 'CFT' },
  { itemName: 'Felt (78X57X0.50)', uom: 'CFT' },
  { itemName: 'Felt (81X69X0.75)', uom: 'CFT' },
  { itemName: 'Geotex', uom: 'SQM' },
  { itemName: '850-1-A', uom: 'YARD' },
  { itemName: '850-2-A', uom: 'YARD' },
  { itemName: '850-3-A', uom: 'YARD' },
  { itemName: '850-4-A', uom: 'YARD' },
  { itemName: '850-5-A', uom: 'YARD' },
  { itemName: '850-6-A', uom: 'YARD' },
  { itemName: '850-7-A', uom: 'YARD' },
  { itemName: 'Adhesive', uom: 'KG' },
  { itemName: 'Lace', uom: 'YARD' },
  { itemName: 'Eyelet', uom: 'PCS' },
  { itemName: 'Foam 280', uom: 'CFT' },
  { itemName: 'Foam Rubber-2005', uom: 'CFT' },
  { itemName: 'Foam Super Soft', uom: 'CFT' },
  { itemName: 'Display Poly', uom: 'YARD' },
  { itemName: 'Wrapping Poly', uom: 'YARD' },
  { itemName: 'Blue Poly', uom: 'YARD' },
  { itemName: 'Corner (Orthopedic-8X10X12)', uom: 'PCS' },
  { itemName: 'Corner (Spring-8X10X12)', uom: 'PCS' },
  { itemName: 'Corner (Pocket Spring-8X10X12)', uom: 'PCS' },
  { itemName: 'Corner (Orthopedic-4X6)', uom: 'PCS' },
  { itemName: 'Poster (Orthopedic)', uom: 'PCS' },
  { itemName: 'Poster (Spring)', uom: 'PCS' },
  { itemName: 'Poster (Pocket Spring)', uom: 'PCS' },
  { itemName: 'Poster (Pillow Top Orthopedic)', uom: 'PCS' },
  { itemName: 'Poster (Pillow Top Spring)', uom: 'PCS' },
  { itemName: 'Poster (Pillow Top Pocket Spring)', uom: 'PCS' },
  { itemName: 'Label (Orthopedic)', uom: 'PCS' },
  { itemName: 'Label (Spring)', uom: 'PCS' },
  { itemName: 'Label (Pocket Spring)', uom: 'PCS' },
  { itemName: 'Label (Pillow Top Orthopedic)', uom: 'PCS' },
  { itemName: 'Label (Pillow Top Spring)', uom: 'PCS' },
  { itemName: 'Label (Pillow Top Pocket Spring)', uom: 'PCS' },
  { itemName: 'Border Rod', uom: 'KG' },
  { itemName: 'Mattress Pad Bag', uom: 'PCS' },
  { itemName: 'Yarn', uom: 'PCS' },
  { itemName: 'Stapler', uom: 'PCS' },
  { itemName: 'Stapler Pin', uom: 'SORA' },
  { itemName: 'Vertic Clip', uom: 'SORA' },
  { itemName: 'Helica Coil', uom: 'KG' },
  { itemName: 'AJMF-800-5-A', uom: 'MTR' },
  { itemName: 'AJMF-800-7-A', uom: 'MTR' },
  { itemName: 'AJMF-800-8-A', uom: 'MTR' },
  { itemName: 'Scotch Tape', uom: 'PCS' },
  { itemName: 'Rangdhanu Felt', uom: 'CFT' },
  { itemName: 'Rangdhanu Ribbon', uom: 'YARD' },
  { itemName: 'Rangdhanu Fabrics', uom: 'YARD' },
  { itemName: 'Rangdhanu Lace', uom: 'YARD' },
  { itemName: 'Rangdhanu Rod', uom: 'PCS' },
  { itemName: 'Zipper', uom: 'INCH' },
  { itemName: 'Elastics Rubber', uom: 'YARD' },
];

async function main() {
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const item of items) {
    // Check if item already exists by itemName
    try {
      const existing = await client.execute({
        sql: 'SELECT id FROM Item WHERE itemName = ?',
        args: [item.itemName],
      });
      if (existing.rows.length > 0) {
        console.log(`SKIP (already exists): ${item.itemName}`);
        skipped++;
        continue;
      }
    } catch (e) {
      // ignore check error, try to create anyway
    }

    // Generate a unique barcode
    const barcode = `BC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Insert the item
    try {
      await client.execute({
        sql: `INSERT INTO Item (id, year, lcNo, group, subGroup, itemName, price, uom, barcode, itemCode, description, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `item_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
          'N/A',         // year
          'N/A',         // lcNo
          'Mattress',    // group
          'Raw Material',// subGroup
          item.itemName, // itemName
          0,             // price (user can edit later)
          item.uom,      // uom
          barcode,       // barcode
          null,          // itemCode
          'Added via batch script', // description
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });
      console.log(`✅ Created: ${item.itemName} (${item.uom})`);
      created++;
    } catch (e) {
      console.error(`❌ Failed: ${item.itemName} — ${e.message}`);
      errors.push({ item: item.itemName, error: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total items in list: ${items.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e.item}: ${e.error}`));
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Script failed:', e);
  process.exit(1);
});
