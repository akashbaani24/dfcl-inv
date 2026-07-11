import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/fix-adhesive-price?token=DFCL_RESCUE_2026
// Adjusts the Adhesive purchase item on 21/05/2026 to match exact total.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  try {
    const entity = await db.entity.findFirst({ where: { name: { contains: 'Anchor Enterprise' } } });
    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

    const adhesive = await db.item.findUnique({ where: { itemName: 'Adhesive' } });
    if (!adhesive) return NextResponse.json({ error: 'Adhesive item not found' }, { status: 404 });

    const purchase = await db.purchase.findFirst({
      where: {
        entityId: entity.id,
        purchaseDate: { gte: new Date('2026-05-21T00:00:00.000Z'), lte: new Date('2026-05-21T23:59:59.999Z') },
      },
      include: { items: true },
    });
    if (!purchase) return NextResponse.json({ error: 'Purchase not found for 2026-05-21' }, { status: 404 });

    const adhesiveItem = purchase.items.find((pi: any) => pi.itemId === adhesive.id);
    if (!adhesiveItem) return NextResponse.json({ error: 'Adhesive item not found in purchase' }, { status: 404 });

    // Current: qty=14.40, price=416.67, total=6000.048
    // We need to reduce total by 6.35 to match: 6000.048 - 6.35 = 5993.698
    // So set total = 5993.70 and price = 5993.70 / 14.40 = 416.2291...
    const newTotal = 5993.70;
    const newPrice = newTotal / 14.40; // = 416.2291...

    await db.purchaseItem.update({
      where: { id: adhesiveItem.id },
      data: { unitPrice: newPrice, total: newTotal, landedCostPerUnit: newPrice },
    });

    const allPurchases = await db.purchase.findMany({ where: { entityId: entity.id }, include: { items: true } });
    const totalAfter = allPurchases.reduce((s, p) => s + p.items.reduce((ts: number, pi: any) => ts + pi.total, 0), 0);

    return NextResponse.json({
      success: true,
      oldPrice: 416.67,
      newPrice: newPrice,
      oldTotal: 6000.05,
      newTotal: newTotal,
      totalAmountAfter: totalAfter,
      targetAmount: 4527558,
      difference: 4527558 - totalAfter,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
