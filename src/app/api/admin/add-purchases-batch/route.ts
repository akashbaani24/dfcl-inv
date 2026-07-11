import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyStockDelta } from '@/lib/stock-guard';

// POST /api/admin/add-purchases-batch?token=DFCL_RESCUE_2026
type Row = { date: string; supplier: string; itemName: string; quantity: number; unitPrice: number };

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const results = { entity: '' as string, suppliersCreated: [] as string[], purchasesCreated: 0, itemsAdded: 0, itemsSkipped: [] as string[], errors: [] as any[] };

  const rows: Row[] = [
    { date: '2025-07-01', supplier: 'M/S Mayer Dowa Traders', itemName: 'Blue Poly', quantity: 146.28, unitPrice: 21.22 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-2-A', quantity: 164, unitPrice: 160 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 100, unitPrice: 160 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 166, unitPrice: 160 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-5-A', quantity: 200, unitPrice: 160 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-6-A', quantity: 120, unitPrice: 160 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 2000, unitPrice: 4 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 36, unitPrice: 5500 },
    { date: '2025-07-01', supplier: 'Anchor Foam Factory', itemName: 'Foam Super Soft', quantity: 38.50, unitPrice: 618 },
    { date: '2025-07-01', supplier: 'M/S Shadia Enterprise', itemName: 'Mattress Pad Bag', quantity: 12, unitPrice: 120 },
    { date: '2025-07-01', supplier: 'Anchor Foam Factory', itemName: 'Foam Super Soft', quantity: 37.74, unitPrice: 618 },
    { date: '2025-07-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Yarn', quantity: 20, unitPrice: 50 },
    { date: '2025-07-02', supplier: 'M/S Shadia Enterprise', itemName: 'Mattress Pad Bag', quantity: 11, unitPrice: 120 },
    { date: '2025-08-06', supplier: 'M/S Fazlu Bhai Traders', itemName: 'Elastics Rubber', quantity: 90, unitPrice: 4 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 514.27, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 336.38, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 323.44, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 316.97, unitPrice: 400 },
    { date: '2025-08-07', supplier: 'Jubayer Enterprise', itemName: 'Helica Coil', quantity: 61, unitPrice: 270 },
    { date: '2025-08-07', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 161.72, unitPrice: 549.72 },
    { date: '2025-08-07', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 64.32, unitPrice: 549.60 },
    { date: '2025-08-07', supplier: 'M/S Sabbir chemical', itemName: 'Suthli', quantity: 12.17, unitPrice: 130 },
    { date: '2025-08-07', supplier: 'M/S Sabbir chemical', itemName: 'Scotch Tape', quantity: 5, unitPrice: 200 },
    { date: '2025-08-08', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 200, unitPrice: 160 },
    { date: '2025-08-16', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-3-A', quantity: 103, unitPrice: 160 },
    { date: '2025-08-16', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.50, unitPrice: 379.31 },
    { date: '2025-08-16', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Wrapping Poly', quantity: 612.50, unitPrice: 21.22 },
    { date: '2025-08-16', supplier: 'Anchor Foam Factory', itemName: 'Foam Rubber-2005', quantity: 5.50, unitPrice: 618 },
    { date: '2025-08-16', supplier: 'Anchor Foam Factory', itemName: 'Foam Super Soft', quantity: 42.19, unitPrice: 618 },
    { date: '2025-08-23', supplier: 'Anchor Foam Factory', itemName: 'Foam Super Soft', quantity: 103.63, unitPrice: 618 },
    { date: '2025-08-25', supplier: 'M/S Mayer Dowa Traders', itemName: 'Blue Poly', quantity: 138, unitPrice: 47.83 },
    { date: '2025-09-04', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 28.13, unitPrice: 618 },
    { date: '2025-09-20', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 39.31, unitPrice: 618 },
    { date: '2025-09-20', supplier: 'M/S Anchor Enterprise', itemName: 'Foam 280', quantity: 33.75, unitPrice: 498 },
    { date: '2025-09-20', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 485.16, unitPrice: 400 },
    { date: '2025-09-21', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-6-A', quantity: 110, unitPrice: 160 },
    { date: '2025-09-21', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 100, unitPrice: 160 },
    { date: '2025-09-30', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 64.32, unitPrice: 549.60 },
    { date: '2025-10-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Spring 8 Inch', quantity: 377.78, unitPrice: 291.17 },
    { date: '2025-10-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Spring 6 Inch', quantity: 4500, unitPrice: 7.50 },
    { date: '2025-10-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 500, unitPrice: 4 },
    { date: '2025-10-01', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 29.18, unitPrice: 376.97 },
    { date: '2025-10-06', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 56.25, unitPrice: 618 },
    { date: '2025-10-07', supplier: 'Hazi Rowson Ali Store', itemName: 'Scotch Tape', quantity: 10, unitPrice: 100 },
    { date: '2025-10-11', supplier: 'Ali Ahmed Foam House', itemName: 'Zipper', quantity: 63, unitPrice: 0.56 },
    { date: '2025-10-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Eyelet', quantity: 40, unitPrice: 12.50 },
    { date: '2025-10-13', supplier: 'Jubayer Enterprise', itemName: 'Border Rod', quantity: 92.80, unitPrice: 160 },
    { date: '2025-10-19', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2025-10-19', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 36, unitPrice: 305.56 },
    { date: '2025-10-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 161.72, unitPrice: 400 },
    { date: '2025-10-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 110, unitPrice: 160 },
    { date: '2025-10-28', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 36.56, unitPrice: 618 },
    { date: '2025-10-23', supplier: 'M/S Shadia Enterprise', itemName: 'Mattress Pad Bag', quantity: 100, unitPrice: 110 },
    { date: '2025-11-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 200, unitPrice: 160 },
    { date: '2025-11-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-2-A', quantity: 100, unitPrice: 160 },
    { date: '2025-11-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 381.94 },
    { date: '2025-11-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2025-11-04', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 42.19, unitPrice: 618 },
    { date: '2025-11-11', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 64.32, unitPrice: 549.60 },
    { date: '2025-11-11', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 161.72, unitPrice: 549.72 },
    { date: '2025-11-16', supplier: 'M/S Mayer Dowa Traders', itemName: 'Blue Poly', quantity: 145.94, unitPrice: 47.83 },
    { date: '2025-11-16', supplier: 'Hazi Rowson Ali Store', itemName: 'Elastics Rubber', quantity: 105, unitPrice: 2.86 },
    { date: '2025-11-26', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 56.25, unitPrice: 618 },
    { date: '2025-11-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 323.44, unitPrice: 400 },
    { date: '2025-11-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 161.72, unitPrice: 400 },
    { date: '2025-11-26', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Wrapping Poly', quantity: 600, unitPrice: 21.67 },
    { date: '2025-12-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 381.94 },
    { date: '2025-12-08', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2025-12-17', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 56.25, unitPrice: 618 },
    { date: '2025-12-17', supplier: 'M/S Mayer Dowa Traders', itemName: 'Blue Poly', quantity: 145.78, unitPrice: 47.57 },
    { date: '2025-12-22', supplier: 'Hazi Rowson Ali Store', itemName: 'Scotch Tape', quantity: 10, unitPrice: 110 },
    { date: '2025-12-23', supplier: 'Anchor Foam Factory', itemName: 'Foam Super Soft', quantity: 70.31, unitPrice: 618 },
    { date: '2025-12-23', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-6-A', quantity: 112, unitPrice: 160 },
    { date: '2025-12-23', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 100, unitPrice: 160 },
    { date: '2025-12-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 50, unitPrice: 160 },
    { date: '2025-12-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 381.94 },
    { date: '2025-12-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2026-01-08', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 126.56, unitPrice: 618 },
    { date: '2026-01-10', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 32.16, unitPrice: 549.60 },
    { date: '2026-01-10', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 161.72, unitPrice: 549.72 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 258.75, unitPrice: 400 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 113.20, unitPrice: 400 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 100, unitPrice: 160 },
    { date: '2026-01-12', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-7-A', quantity: 50, unitPrice: 160 },
    { date: '2026-01-18', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X7)', quantity: 113.20, unitPrice: 400 },
    { date: '2026-01-18', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 64.69, unitPrice: 400 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Geotex', quantity: 188, unitPrice: 105 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 161.72, unitPrice: 400 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 381.94 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-3-A', quantity: 100, unitPrice: 160 },
    { date: '2026-01-27', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-6-A', quantity: 101, unitPrice: 160 },
    { date: '2026-02-08', supplier: 'M/S Mayer Dowa Traders', itemName: 'Blue Poly', quantity: 193.75, unitPrice: 47.48 },
    { date: '2026-02-09', supplier: 'M/S Anchor Enterprise', itemName: 'Foam 280', quantity: 10.58, unitPrice: 498 },
    { date: '2026-02-09', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 33.75, unitPrice: 618 },
    { date: '2026-02-08', supplier: 'Default', itemName: 'AJMF-800-5-A', quantity: 107.50, unitPrice: 550 },
    { date: '2026-02-08', supplier: 'Default', itemName: 'AJMF-800-7-A', quantity: 76, unitPrice: 550 },
    { date: '2026-02-08', supplier: 'Default', itemName: 'AJMF-800-8-A', quantity: 28.50, unitPrice: 550 },
    { date: '2026-02-16', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Yarn', quantity: 50, unitPrice: 50 },
    { date: '2026-02-26', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 70.31, unitPrice: 618 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 504.56, unitPrice: 400 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 50, unitPrice: 160 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-2-A', quantity: 50, unitPrice: 160 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 114, unitPrice: 160 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-5-A', quantity: 205, unitPrice: 160 },
    { date: '2026-02-28', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-7-A', quantity: 204, unitPrice: 160 },
    { date: '2026-03-03', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Wrapping Poly', quantity: 600, unitPrice: 21.67 },
    { date: '2026-03-03', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 381.94 },
    { date: '2026-03-03', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2026-03-08', supplier: 'Hazi Rowson Ali Store', itemName: 'Scotch Tape', quantity: 10, unitPrice: 110 },
    { date: '2026-03-11', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 161.42, unitPrice: 550.74 },
    { date: '2026-03-11', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 32.16, unitPrice: 549.60 },
    { date: '2026-04-06', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 416.67 },
    { date: '2026-04-11', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 33.75, unitPrice: 618 },
    { date: '2026-05-04', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 70.31, unitPrice: 618 },
    { date: '2026-05-06', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 50, unitPrice: 160 },
    { date: '2026-05-06', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-3-A', quantity: 50, unitPrice: 160 },
    { date: '2026-05-06', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 416.67 },
    { date: '2026-05-06', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2026-05-06', supplier: 'Bikrampur Store', itemName: 'Blue Poly', quantity: 144.78, unitPrice: 58.59 },
    { date: '2026-05-09', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-3-A', quantity: 40, unitPrice: 160 },
    { date: '2026-05-23', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 40.43, unitPrice: 640 },
    { date: '2026-05-23', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 64.32, unitPrice: 639.77 },
    { date: '2026-06-07', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 28.80, unitPrice: 416.67 },
    { date: '2026-06-10', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 30.94, unitPrice: 618 },
    { date: '2026-06-15', supplier: 'M/S Anchor Enterprise', itemName: 'Foam Super Soft', quantity: 70.31, unitPrice: 618 },
    { date: '2026-06-15', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-6-A', quantity: 111, unitPrice: 160 },
    { date: '2026-06-15', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-4-A', quantity: 100, unitPrice: 160 },
    { date: '2026-06-15', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 416.67 },
    { date: '2026-06-15', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Lace', quantity: 1000, unitPrice: 4 },
    { date: '2026-06-24', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X4)', quantity: 194.06, unitPrice: 400 },
    { date: '2026-06-24', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-7-A', quantity: 161, unitPrice: 160 },
    { date: '2026-06-30', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (81X69X0.50)', quantity: 97.03, unitPrice: 640 },
    { date: '2026-06-30', supplier: 'B.J. Bed Company Ltd', itemName: 'Felt (78X57X0.50)', quantity: 51.46, unitPrice: 639.72 },
    { date: '2026-07-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-5-A', quantity: 22, unitPrice: 160 },
    { date: '2026-07-04', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Adhesive', quantity: 43.20, unitPrice: 416.67 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X2)', quantity: 64.69, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X3)', quantity: 194.06, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: 'Ribbond (81X69X5)', quantity: 113.20, unitPrice: 400 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-2-A', quantity: 50, unitPrice: 160 },
    { date: '2026-07-05', supplier: 'Al Madina Rebon dad Foam & Mattress', itemName: '850-1-A', quantity: 65, unitPrice: 160 },
  ];

  try {
    // Step 1: Find or create entity
    let entity = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entity) {
      entity = await db.entity.create({ data: { name: 'M/S Anchor Enterprise', description: 'Mattress raw materials entity', entityType: 'warehouse' } });
      results.entity = `Created: ${entity.name}`;
    } else {
      results.entity = `Existing: ${entity.name}`;
    }
    const entityId = entity.id;

    // Step 2: Create suppliers
    const uniqueSuppliers = Array.from(new Set(rows.map(r => r.supplier)));
    const supplierMap = new Map<string, string>();
    for (const supName of uniqueSuppliers) {
      let supplier = await db.supplier.findFirst({ where: { name: supName } });
      if (!supplier) { supplier = await db.supplier.create({ data: { name: supName } }); results.suppliersCreated.push(supName); }
      supplierMap.set(supName, supplier.id);
    }

    // Step 3: Ensure "Suthli" item exists
    let suthli = await db.item.findUnique({ where: { itemName: 'Suthli' } });
    if (!suthli) {
      suthli = await db.item.create({ data: { year: 'N/A', lcNo: 'N/A', group: 'Mattress', subGroup: 'Raw Material', itemName: 'Suthli', price: 0, uom: 'PCS', barcode: `BC${Date.now()}${Math.floor(1000+Math.random()*9000)}`, description: 'Added via purchase batch' } });
    }

    // Step 4: Group by (date, supplier)
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = `${row.date}|${row.supplier}`;
      const arr = groups.get(key) || []; arr.push(row); groups.set(key, arr);
    }

    // Step 5: Create purchases
    let pc = 0;
    for (const [key, groupRows] of groups.entries()) {
      const [dateStr, supplierName] = key.split('|');
      const supplierId = supplierMap.get(supplierName);
      pc++;
      const dateStrCompact = dateStr.replace(/-/g, '');
      const purchaseNo = `PUR-${dateStrCompact}-${String(pc).padStart(4, '0')}-${Math.floor(Math.random()*10000)}`;
      try {
        const purchaseItemsData = [];
        for (const row of groupRows) {
          const item = await db.item.findUnique({ where: { itemName: row.itemName } });
          if (!item) { results.itemsSkipped.push(`${row.itemName} (not found)`); continue; }
          const qty = row.quantity;
          const total = qty * row.unitPrice;
          purchaseItemsData.push({ itemId: item.id, quantity: qty, unitPrice: row.unitPrice, uom: item.uom || 'PCS', total, cogsPerUnit: 0, landedCostPerUnit: row.unitPrice });
          results.itemsAdded++;
        }
        if (purchaseItemsData.length === 0) continue;

        await db.purchase.create({
          data: {
            purchaseNo, purchaseDate: new Date(dateStr), purchaseType: 'local',
            entityId, supplierId: supplierId || null,
            billNo: `BILL-${dateStrCompact}-${pc}`,
            status: 'approved',
            notes: `Batch import — Supplier: ${supplierName}`,
            items: { create: purchaseItemsData },
          },
        });

        // Step 6: Increment stock
        for (const pi of purchaseItemsData) {
          try { await applyStockDelta(db, pi.itemId, entityId, pi.quantity); } catch (e: any) { results.errors.push({ purchase: purchaseNo, item: pi.itemId, error: `Stock: ${e.message}` }); }
        }
        results.purchasesCreated++;
      } catch (e: any) { results.errors.push({ purchase: purchaseNo, error: e.message }); }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
