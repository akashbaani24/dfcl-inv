import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// GET /api/purchases?entityId=xxx&status=pending
// Returns list of purchases for the user's accessible entities
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const status = searchParams.get('status') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null
      : currentUser.entityAccess.map(ea => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ purchases: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };
    if (status) where.status = status;

    const purchases = await db.purchase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        entity: { select: { name: true } },
        supplier: { select: { name: true } },
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    // Compute grand total per purchase
    const withTotals = purchases.map(p => {
      const grandTotal = p.items.reduce((sum, pi) => sum + pi.total, 0);
      return {
        ...p,
        grandTotal,
        itemCount: p.items.length,
      };
    });

    return NextResponse.json({ purchases: withTotals });
  } catch (error) {
    console.error('Get purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/purchases — create new purchase
// Body: { purchaseDate, purchaseType, entityId, supplierId, billNo, notes, items: [{itemId, quantity, unitPrice, uom}] }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // ★ Per-menu create permission (Function → Purchase → Create)
    if (!canMenu(currentUser, 'purchase', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create purchases' }, { status: 403 });
    }

    const body = await request.json();
    const { purchaseDate, purchaseType, entityId, supplierId, billNo, notes, items } = body;

    if (!entityId) return NextResponse.json({ error: 'Entity (Purchase For) is required' }, { status: 400 });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }
    if (!['foreign', 'local'].includes(purchaseType || 'local')) {
      return NextResponse.json({ error: 'purchaseType must be "foreign" or "local"' }, { status: 400 });
    }

    // Auto-generate purchase number: PUR-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    const purchaseNo = `PUR-${dateStr}-${randomStr}`;

    // Build items with computed total
    const itemsData = items.map((it: any) => {
      const qty = parseInt(it.quantity) || 1;
      const price = parseFloat(it.unitPrice) || 0;
      return {
        itemId: it.itemId,
        quantity: qty,
        unitPrice: price,
        uom: it.uom || 'PCS',
        total: qty * price,
      };
    });

    const purchase = await db.purchase.create({
      data: {
        purchaseNo,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        purchaseType: purchaseType || 'local',
        entityId,
        supplierId: supplierId || null,
        billNo: billNo || null,
        notes: notes || null,
        status: 'pending',
        createdBy: currentUser.id,
        items: { create: itemsData },
      },
      include: {
        entity: { select: { name: true } },
        supplier: { select: { name: true } },
        items: { include: { item: { select: { itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    const grandTotal = purchase.items.reduce((sum, pi) => sum + pi.total, 0);
    return NextResponse.json({ purchase: { ...purchase, grandTotal } });
  } catch (error) {
    console.error('Create purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
