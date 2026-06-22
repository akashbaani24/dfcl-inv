import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/items/lookup-by-barcode?barcode=xxx
//
// Lightweight EXACT-MATCH lookup by Item.barcode.
// Returns: { item: {...} | null }
//
// Used by the "Add Stock" dialog's live barcode lookup.
// The old approach used /api/items?search=X which does a LIKE search across
// 22k items in 9 different columns — way too slow for a per-keystroke lookup.
// This endpoint uses findUnique on the indexed barcode column → ~5ms response.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const barcode = request.nextUrl.searchParams.get('barcode')?.trim();
    if (!barcode) {
      return NextResponse.json({ item: null });
    }

    // Exact match on the unique indexed barcode column.
    const item = await db.item.findUnique({
      where: { barcode },
      select: {
        id: true,
        itemName: true,
        barcode: true,
        itemCode: true,
        uom: true,
        price: true,
        group: true,
        subGroup: true,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Lookup by barcode error:', error);
    return NextResponse.json(
      { error: 'Lookup failed: ' + String(error) },
      { status: 500 }
    );
  }
}
