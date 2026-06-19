import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT /api/purchases/[id]/cogs
// Update COGS (Cost of Goods Sold) for all items in a purchase.
// Body: { items: [{ id: purchaseItemId, cogsPerUnit: number, cogsNotes: string }] }
// Or:   { items: [{ itemId, cogsPerUnit, cogsNotes }] }  — matches by itemId within this purchase
//
// After update, landedCostPerUnit is recomputed = unitPrice + cogsPerUnit.
// Permission: admin/manager (or any user with 'purchase' menu edit permission)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can update COGS' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const items = body.items || body.cogsItems || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    // Verify the purchase exists
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    let updatedCount = 0;
    for (const it of items) {
      const cogsPerUnit = parseFloat(it.cogsPerUnit) || 0;
      const cogsNotes = it.cogsNotes || null;
      // Find the purchase item by id OR by itemId (within this purchase)
      let purchaseItem = null;
      if (it.id) {
        purchaseItem = purchase.items.find(pi => pi.id === it.id);
      } else if (it.itemId) {
        purchaseItem = purchase.items.find(pi => pi.itemId === it.itemId);
      }
      if (!purchaseItem) continue;
      await db.purchaseItem.update({
        where: { id: purchaseItem.id },
        data: {
          cogsPerUnit,
          cogsNotes,
          landedCostPerUnit: purchaseItem.unitPrice + cogsPerUnit,
        },
      });
      updatedCount++;
    }

    // Return the updated purchase with items
    const updated = await db.purchase.findUnique({
      where: { id },
      include: {
        entity: { select: { name: true } },
        supplier: { select: { name: true } },
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    const grandTotal = (updated?.items || []).reduce((s, pi) => s + pi.total, 0);
    const totalCogs = (updated?.items || []).reduce((s, pi) => s + pi.cogsPerUnit * pi.quantity, 0);
    const totalLanded = (updated?.items || []).reduce((s, pi) => s + pi.landedCostPerUnit * pi.quantity, 0);

    return NextResponse.json({
      success: true,
      updatedCount,
      purchase: { ...updated, grandTotal },
      totals: {
        grandTotal,
        totalCogs,
        totalLanded,
      },
      message: `COGS updated for ${updatedCount} item(s).`,
    });
  } catch (error) {
    console.error('Update COGS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/purchases/[id]/cogs — returns the COGS summary for this purchase
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        items: {
          include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } },
        },
      },
    });
    if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    const items = purchase.items.map(pi => ({
      id: pi.id,
      itemId: pi.itemId,
      itemName: pi.item?.itemName || '-',
      quantity: pi.quantity,
      unitPrice: pi.unitPrice,
      uom: pi.uom,
      cogsPerUnit: pi.cogsPerUnit,
      cogsNotes: pi.cogsNotes,
      landedCostPerUnit: pi.landedCostPerUnit,
      totalCogs: pi.cogsPerUnit * pi.quantity,
      totalLanded: pi.landedCostPerUnit * pi.quantity,
    }));

    return NextResponse.json({
      purchaseId: purchase.id,
      purchaseNo: purchase.purchaseNo,
      items,
      totals: {
        grandTotal: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        totalCogs: items.reduce((s, i) => s + i.totalCogs, 0),
        totalLanded: items.reduce((s, i) => s + i.totalLanded, 0),
      },
    });
  } catch (error) {
    console.error('Get COGS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
