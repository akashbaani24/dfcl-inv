import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

// POST /api/admin/bulk-create-items?token=DFCL_RESCUE_2026
// Body: multipart/form-data with field 'file' = .xlsx file
//
// Reads the Excel file, extracts all distinct (product_name, category, subcategory,
// barcode, product_price) rows, and creates Item records for any that don't
// already exist in the Item master table.
//
// Mapping rules (per user request):
//   category = "Fabric"      → group = "Fabric",      uom = "Mtr"
//   category = "Bedding"     → group = "Bedding",     uom = "PCS"
//   category = "Accessory"   → group = "Accessory",   uom = "PCS"
//   category = "Ready Made"  → group = "Ready Made",  uom = "PCS"
//   category = "Blind"       → group = "Blind",       uom = "PCS"
//   (anything else)          → group = category,       uom = "PCS"
//
// Excel columns expected:
//   product_name, category, subcategory, barcode, product_price
//
// Response: { success, totalDistinct, alreadyExisted, created, errors }
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const expected = process.env.MIGRATION_RESCUE_TOKEN || 'DFCL_RESCUE_2026';
    if (token !== expected) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Parse Excel
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file has no data rows' }, { status: 400 });
    }

    // Extract distinct items from Excel
    // Key = product_name (lowercased, trimmed) → { name, category, subcategory, barcode, price }
    const excelItems = new Map<string, { name: string; category: string; subcategory: string; barcode: string; price: number }>();
    for (const r of rows) {
      const name = String(r.product_name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!excelItems.has(key)) {
        const category = String(r.category || '').trim();
        const subcategory = String(r.subcategory || '').trim();
        const barcode = String(r.barcode || '').trim();
        const price = parseFloat(String(r.product_price || '0')) || 0;
        excelItems.set(key, { name, category, subcategory, barcode, price });
      }
    }

    // Pre-load ALL existing items from DB (by itemName, lowercased)
    const allItems = await db.item.findMany({ select: { id: true, itemName: true } });
    const existingNames = new Set<string>();
    for (const it of allItems) {
      existingNames.add(it.itemName.toLowerCase().trim());
    }

    // Determine which items need to be created
    const toCreate: Array<{ itemName: string; group: string; subGroup: string; uom: string; barcode: string | null; price: number; year: string; lcNo: string; itemCode: string | null }> = [];
    let alreadyExisted = 0;

    for (const [key, item] of excelItems) {
      if (existingNames.has(key)) {
        alreadyExisted++;
        continue;
      }

      // Map category → group + uom
      let group = item.category || 'N/A';
      let uom = 'PCS';
      switch (item.category.toLowerCase()) {
        case 'fabric': group = 'Fabric'; uom = 'Mtr'; break;
        case 'bedding': group = 'Bedding'; uom = 'PCS'; break;
        case 'accessory': group = 'Accessory'; uom = 'PCS'; break;
        case 'ready made': group = 'Ready Made'; uom = 'PCS'; break;
        case 'blind': group = 'Blind'; uom = 'PCS'; break;
      }

      toCreate.push({
        itemName: item.name,
        group,
        subGroup: item.subcategory || 'N/A',
        uom,
        barcode: item.barcode || null,
        price: item.price,
        year: 'N/A',
        lcNo: 'N/A',
        itemCode: null,
      });
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        success: true,
        totalDistinct: excelItems.size,
        alreadyExisted,
        created: 0,
        message: `All ${excelItems.size} items already exist in the database. No new items to create.`,
      });
    }

    // Create items in batches of 500 using $transaction
    const BATCH = 500;
    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < toCreate.length; i += BATCH) {
      const chunk = toCreate.slice(i, i + BATCH);
      const ops = chunk.map(item =>
        db.item.create({
          data: {
            itemName: item.itemName,
            year: item.year,
            lcNo: item.lcNo,
            group: item.group,
            subGroup: item.subGroup,
            price: item.price,
            uom: item.uom,
            barcode: item.barcode,
            itemCode: item.itemCode,
          },
        })
      );
      try {
        await db.$transaction(ops);
        created += chunk.length;
      } catch (e: any) {
        // If batch fails (likely duplicate name), try one by one
        for (const item of chunk) {
          try {
            await db.item.create({
              data: {
                itemName: item.itemName,
                year: item.year,
                lcNo: item.lcNo,
                group: item.group,
                subGroup: item.subGroup,
                price: item.price,
                uom: item.uom,
                barcode: item.barcode,
                itemCode: item.itemCode,
              },
            });
            created++;
          } catch (e2: any) {
            errors.push(`"${item.itemName}": ${e2.message.substring(0, 60)}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalDistinct: excelItems.size,
      alreadyExisted,
      created,
      errors: errors.slice(0, 20),
      message: `Created ${created} new items. ${alreadyExisted} already existed. ${errors.length} errors.`,
    });
  } catch (error: any) {
    console.error('Bulk create items error:', error);
    return NextResponse.json(
      { error: 'Failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
