import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/add-items-batch?token=DFCL_RESCUE_2026
// Adds 61 new items to the production database.
// Each item gets a unique auto-generated barcode.
// If an item already exists (by itemName), it is skipped.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

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

  const results = { created: [] as string[], skipped: [] as string[], errors: [] as any[] };

  for (const item of items) {
    try {
      // Check if item already exists
      const existing = await db.item.findUnique({ where: { itemName: item.itemName }, select: { id: true } });
      if (existing) {
        results.skipped.push(item.itemName);
        continue;
      }

      // Generate unique barcode: YYMMDD + 7 digits
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const rand = Math.floor(1000000 + Math.random() * 9000000);
      const barcode = `${yy}${mm}${dd}${rand}`;

      // Create the item
      await db.item.create({
        data: {
          year: 'N/A',
          lcNo: 'N/A',
          group: 'Mattress',
          subGroup: 'Raw Material',
          itemName: item.itemName,
          price: 0,
          uom: item.uom,
          barcode,
          description: 'Added via batch script',
        },
      });
      results.created.push(`${item.itemName} (${item.uom})`);
    } catch (e: any) {
      // If barcode collision, retry without barcode
      if (e?.code === 'P2002') {
        try {
          await db.item.create({
            data: {
              year: 'N/A',
              lcNo: 'N/A',
              group: 'Mattress',
              subGroup: 'Raw Material',
              itemName: item.itemName,
              price: 0,
              uom: item.uom,
              description: 'Added via batch script (no barcode)',
            },
          });
          results.created.push(`${item.itemName} (${item.uom}) [no barcode]`);
          continue;
        } catch (e2: any) {
          results.errors.push({ item: item.itemName, error: e2.message });
          continue;
        }
      }
      results.errors.push({ item: item.itemName, error: e.message });
    }
  }

  return NextResponse.json({
    summary: {
      total: items.length,
      created: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    },
    created: results.created,
    skipped: results.skipped,
    errors: results.errors,
  });
}
