import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/fix-ajmf-barcodes?token=DFCL_RESCUE_2026
// Generates and assigns barcodes to ALL items that don't have one (including AJMF).
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const results = { updated: [] as any[], errors: [] as any[] };

  try {
    const itemsWithoutBarcode = await db.item.findMany({
      where: { OR: [{ barcode: null }, { barcode: '' }] },
      select: { id: true, itemName: true },
    });

    for (const item of itemsWithoutBarcode) {
      try {
        const ts = Date.now().toString().slice(-10);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const newBarcode = `BC${ts}${rand}`;
        await db.item.update({ where: { id: item.id }, data: { barcode: newBarcode } });
        results.updated.push({ itemName: item.itemName, barcode: newBarcode });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          try {
            const newBarcode = `BC${Date.now()}${Math.floor(Math.random() * 99999)}`;
            await db.item.update({ where: { id: item.id }, data: { barcode: newBarcode } });
            results.updated.push({ itemName: item.itemName, barcode: newBarcode });
          } catch (e2: any) { results.errors.push({ item: item.itemName, error: e2.message }); }
        } else { results.errors.push({ item: item.itemName, error: e.message }); }
      }
    }

    // Check AJMF items specifically
    const ajmfItems = await db.item.findMany({
      where: { itemName: { contains: 'AJMF' } },
      select: { id: true, itemName: true, barcode: true },
    });

    return NextResponse.json({
      summary: { totalWithoutBarcode: itemsWithoutBarcode.length, updated: results.updated.length, errors: results.errors.length,
        ajmfItems: ajmfItems.map(i => ({ name: i.itemName, barcode: i.barcode })) },
      results,
    });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
