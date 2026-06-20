import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';

// GET /api/purchases/[id] — purchase detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: {
        entity: { select: { name: true } },
        supplier: { select: { name: true, phone: true, address: true } },
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true, group: true, subGroup: true } } } },
        receives: { include: { item: { select: { itemName: true, barcode: true } } } },
      },
    });

    if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    const grandTotal = purchase.items.reduce((sum, pi) => sum + pi.total, 0);
    return NextResponse.json({ purchase: { ...purchase, grandTotal } });
  } catch (error) {
    console.error('Get purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/purchases/[id] — update purchase (only if status is still "pending")
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (!canMenu(currentUser, 'purchase', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit purchases' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { purchaseDate, purchaseType, entityId, supplierId, billNo, notes, status, items } = body;

    const existing = await db.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Cannot edit purchase in status "${existing.status}". Only pending purchases can be edited.` }, { status: 400 });
    }

    // If items provided, replace them
    if (items && Array.isArray(items)) {
      await db.purchaseItem.deleteMany({ where: { purchaseId: id } });
      const itemsData = items.map((it: any) => {
        const qty = parseInt(it.quantity) || 1;
        const price = parseFloat(it.unitPrice) || 0;
        const cogsPerUnit = parseFloat(it.cogsPerUnit) || 0;
        return {
          purchaseId: id,
          itemId: it.itemId,
          quantity: qty,
          unitPrice: price,
          uom: it.uom || 'PCS',
          total: qty * price,
          cogsPerUnit,
          cogsNotes: it.cogsNotes || null,
          landedCostPerUnit: price + cogsPerUnit,
        };
      });
      await db.purchaseItem.createMany({ data: itemsData });
    }

    const updated = await db.purchase.update({
      where: { id },
      data: {
        ...(purchaseDate && { purchaseDate: new Date(purchaseDate) }),
        ...(purchaseType && { purchaseType }),
        ...(entityId && { entityId }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(billNo !== undefined && { billNo: billNo || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status && { status }),
      },
      include: {
        entity: { select: { name: true } },
        supplier: { select: { name: true } },
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    const grandTotal = updated.items.reduce((sum, pi) => sum + pi.total, 0);
    return NextResponse.json({ purchase: { ...updated, grandTotal } });
  } catch (error) {
    console.error('Update purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/purchases/[id] — delete purchase (only if pending)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (!canMenu(currentUser, 'purchase', 'delete')) {
      return NextResponse.json({ error: 'You do not have permission to delete purchases' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.purchase.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Cannot delete purchase in status "${existing.status}"` }, { status: 400 });
    }

    await db.purchase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
