import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET /api/supplier-payments?entityId=xxx&supplierId=xxx
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const supplierId = searchParams.get('supplierId') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager') ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && userEntityIds.length === 0) return NextResponse.json({ payments: [] });

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };
    if (supplierId) where.supplierId = supplierId;

    const payments = await db.supplierPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { name: true } },
        entity: { select: { name: true } },
        purchase: { select: { purchaseNo: true } },
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Get supplier payments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/supplier-payments
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { supplierId, purchaseId, entityId, amount, paymentDate, paymentType, chequeNo, bankName, notes } = await request.json();
    if (!supplierId || !entityId || !amount) {
      return NextResponse.json({ error: 'Supplier, entity, and amount are required' }, { status: 400 });
    }

    const payment = await db.supplierPayment.create({
      data: {
        supplierId, purchaseId: purchaseId || null, entityId,
        amount: parseFloat(amount), paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentType: paymentType || 'cash', chequeNo: chequeNo || null, bankName: bankName || null,
        notes: notes || null, createdBy: currentUser.id,
      },
      include: { supplier: { select: { name: true } }, entity: { select: { name: true } }, purchase: { select: { purchaseNo: true } } },
    });

    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Create supplier payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
