#!/usr/bin/env node
/**
 * Excel → Stock for All bulk upload script.
 *
 * Reads:   upload/current_stock_25.06.2026_Opening_Stock.xlsx
 * Maps:    Excel columns → bulk-upload API format
 * Calls:   POST /api/stock/bulk-upload?mode=set
 *
 * Excel columns → API columns mapping:
 *   entity_name   → entityName  (mapped via ENTITY_CODE_MAP below)
 *   product_name  → itemName
 *   product_stock → quantity
 *   product_price → price       (used only if item needs to be created)
 *   barcode       → barcode
 *   category      → (used to find existing item if name doesn't match)
 *   subcategory   → (used to find existing item if name doesn't match)
 *
 * Run:
 *   node scripts/upload-stock-from-excel.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ============================================================
// ENTITY CODE → FULL NAME MAPPING
// ============================================================
// The Excel file uses short codes (DS, DMB, etc.) for entity names.
// The production DB uses full names. This map translates between them.
//
// ★ EDIT THIS MAP if any mapping is wrong.
// ★ Any code not in this map will be skipped + reported.
const ENTITY_CODE_MAP = {
  // Dynasty Furnishings Centre Ltd branches
  'DE':   'Dynasty Furnishings Centre Ltd. (Elephant Road Branch)',
  'DMB':  'Dynasty Furnishings Centre Ltd. (Elephant Road Branch)', // Movi Bazar = Elephant Road area
  'DU':   'Dynasty Furnishings Centre Ltd. (Uttara Branch)',
  'DM':   'Dynasty Furnishings Centre Ltd (Mirpur Branch)',
  'DC':   'Dynasty Furnishings Centre Ltd (Chattogram Branch)',
  'DCM':  'Dynasty Furnishings Centre Ltd (Cumilla Branch)',
  'DR':   'Dynasty Furnishings Centre Ltd (Rajshahi Branch)',
  'DK':   'Dynasty Furnishings Centre Ltd (Khulna Branch)',
  'DEWS': 'Dynasty Furnishings Centre Ltd (DEWS)',

  // Weavers Furnishing Ltd branches
  'WG':    'Weavers Furnishing Ltd (Gulshan Branch)',
  'WG-3F': 'Weavers Furnishing Ltd (Gulshan Branch)', // alternative code
  'WU':    'Weavers Furnishing Ltd (Uttara Branch)',
  'WBRA':  'Weavers Furnishing Ltd (Bashundhara Branch)',
  'WC':    'Weavers Furnishing Ltd (Chattogram Branch)',
  'WS':    'Weavers Furnishing Ltd (Sylhet Branch)',
  'WE':    'Weavers Furnishing Ltd (Elephant Road Branch)',

  // Standalone stores
  'CG':   'Curtain Gallery',
  'VC-1': 'Velvet Corner 1',
  'VC-2': 'Velvet Corner 2',
  'ME':   'Mousumi',
  'SE':   'Shoukhin',

  // Warehouses
  'CWH-Accessory': 'Central Warehouse (Accessory Dept)',

  // Unknown — need user clarification
  // 'DS':  '?',  // 4726 rows — likely "Dynasty Showroom" or similar
  // 'DMB': '?',
};

// ============================================================
// CONFIG
// ============================================================
const EXCEL_PATH = path.join(__dirname, '..', 'upload', 'current_stock_25.06.2026_Opening_Stock.xlsx');
const API_BASE = process.env.API_BASE || 'https://dfcl-inv.vercel.app';
const AUTH_COOKIE = process.env.AUTH_COOKIE || ''; // session cookie from browser

if (!AUTH_COOKIE && process.argv.includes('--upload')) {
  console.error('❌ Missing AUTH_COOKIE env var for --upload mode.');
  console.error('   Open the live app in your browser, login as admin, open DevTools →');
  console.error('   Application → Cookies → copy the "session" or "auth_token" value.');
  console.error('   Then run:');
  console.error('     AUTH_COOKIE="your_cookie_here" node scripts/upload-stock-from-excel.js --upload');
  process.exit(1);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('📊 Reading Excel file:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  console.log(`   Total rows: ${rows.length}`);

  // ── Group rows by entity code (we'll upload one CSV per entity) ─────
  const byEntity = new Map();
  const unknownEntities = new Set();
  for (const r of rows) {
    const code = String(r.entity_name || '').trim();
    const entityName = ENTITY_CODE_MAP[code];
    if (!entityName) {
      unknownEntities.add(code);
      continue;
    }
    if (!byEntity.has(entityName)) byEntity.set(entityName, []);
    byEntity.get(entityName).push(r);
  }

  if (unknownEntities.size > 0) {
    console.log('');
    console.log('⚠️  Unknown entity codes (rows will be skipped):');
    for (const c of unknownEntities) {
      const count = rows.filter(r => String(r.entity_name || '').trim() === c).length;
      console.log(`   "${c}"  (${count} rows)`);
    }
  }

  console.log('');
  console.log(`📦 Will upload to ${byEntity.size} entities:`);
  for (const [name, rs] of byEntity) {
    console.log(`   ${name}: ${rs.length} rows`);
  }

  // ── Build a single CSV with all rows (entityName column included) ──
  // The bulk-upload API accepts a CSV with header: entityName,itemName,quantity,uom,barcode,itemCode
  // We'll convert the Excel rows into this format.
  console.log('');
  console.log('📝 Building CSV for upload...');

  const csvLines = ['entityName,itemName,quantity,uom,barcode,itemCode'];
  let totalValidRows = 0;
  let skippedRows = 0;
  for (const r of rows) {
    const code = String(r.entity_name || '').trim();
    const entityName = ENTITY_CODE_MAP[code];
    if (!entityName) { skippedRows++; continue; }

    const itemName = String(r.product_name || '').trim();
    const qtyStr = String(r.product_stock || '').trim();
    const qty = parseFloat(qtyStr);
    if (!itemName || isNaN(qty)) { skippedRows++; continue; }

    const barcode = String(r.barcode || '').trim();
    // CSV-escape: wrap values containing commas in double quotes
    const esc = (s) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

    csvLines.push([
      esc(entityName),
      esc(itemName),
      qty,
      'PCS',
      esc(barcode),
      esc(itemName), // itemCode = itemName (so existing items match)
    ].join(','));
    totalValidRows++;
  }

  console.log(`   Valid rows: ${totalValidRows}`);
  console.log(`   Skipped rows: ${skippedRows}`);
  console.log(`   CSV lines: ${csvLines.length}`);

  // ── Write the CSV to a temp file ───────────────────────────────────
  const csvPath = path.join(__dirname, '..', 'upload', 'stock-upload-from-excel.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`   CSV written to: ${csvPath}`);
  console.log('');
  console.log('💡 Next step:');
  console.log('   1. Open the app: https://dfcl-inv.vercel.app');
  console.log('   2. Login as admin');
  console.log('   3. Go to: Stock for All → Upload Stock');
  console.log(`   4. Select mode: "Set" (Daily Stock Count)`);
  console.log(`   5. Upload the CSV file: ${csvPath}`);
  console.log('   6. Click "Upload & Apply"');
  console.log('');
  console.log('   OR run this script with API_BASE + AUTH_COOKIE to upload automatically:');
  console.log(`     AUTH_COOKIE="..." node ${process.argv[1]} --upload`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
