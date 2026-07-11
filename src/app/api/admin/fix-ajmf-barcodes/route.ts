import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/fix-ajmf-barcodes?token=DFCL_RESCUE_2026
// Simpler version: just fix AJMF items (3 items only, fast).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  try {
    // Find AJMF items without barcode
    const ajmfItems = await db.item.findMany({
      where: { itemName: { contains: 'AJMF' }, OR: [{ barcode: null }, { barcode: '' }] },
      select: { id: true, itemName: true },
    });

    const updated = [];
    for (const item of ajmfItems) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const newBarcode = `${yy}${mm}${dd}${Math.floor(1000000 + Math.random() * 9000000)}`;
      try {
        await db.item.update({ where: { id: item.id }, data: { barcode: newBarcode } });
        updated.push({ itemName: item.itemName, barcode: newBarcode });
      } catch (e: any) {
        // Retry with different barcode
        try {
          const now2 = new Date();
          const alt = `${String(now2.getFullYear()).slice(-2)}${String(now2.getMonth() + 1).padStart(2, '0')}${String(now2.getDate()).padStart(2, '0')}${Math.floor(1000000 + Math.random() * 9000000)}`;
          await db.item.update({ where: { id: item.id }, data: { barcode: alt } });
          updated.push({ itemName: item.itemName, barcode: alt });
        } catch {}
      }
    }

    // Also fix any other items without barcode (limit to 50)
    const otherItems = await db.item.findMany({
      where: { itemName: { not: { contains: 'AJMF' } }, OR: [{ barcode: null }, { barcode: '' }] },
      select: { id: true, itemName: true },
      take: 50,
    });

    for (const item of otherItems) {
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const newBarcode = `${yy}${mm}${dd}${Math.floor(1000000 + Math.random() * 9000000)}`;
      try {
        await db.item.update({ where: { id: item.id }, data: { barcode: newBarcode } });
        updated.push({ itemName: item.itemName, barcode: newBarcode });
      } catch {}
    }

    // Verify AJMF items now have barcodes
    const verify = await db.item.findMany({
      where: { itemName: { contains: 'AJMF' } },
      select: { itemName: true, barcode: true },
    });

    return NextResponse.json({
      updated: updated.length,
      items: updated,
      ajmfVerification: verify,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
