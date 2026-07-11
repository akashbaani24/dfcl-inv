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
      const newBarcode = `BC${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        await db.item.update({ where: { id: item.id }, data: { barcode: newBarcode } });
        updated.push({ itemName: item.itemName, barcode: newBarcode });
      } catch (e: any) {
        // Retry with different barcode
        try {
          const alt = `BC${Date.now()}${Math.floor(Math.random() * 99999)}`;
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
      const newBarcode = `BC${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
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
