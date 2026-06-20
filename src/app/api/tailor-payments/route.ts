import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';

// GET /api/tailor-payments?entityId=xxx&salesOrderId=xxx&tailorId=xxx
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const salesOrderId = searchParams.get('salesOrderId') || '';
    const tailorId = searchParams.get('tailorId') || '';

    // Access control: non-admin/manager can only see their assigned entities
    const userEntityIds =
      currentUser.role === 'admin' || currentUser.role === 'manager'
        ? null
        : currentUser.entityAccess.map((ea) => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ payments: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (tailorId) where.tailorId = tailorId;

    const payments = await db.tailorPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        tailor: { select: { id: true, name: true, phone: true } },
        salesOrder: {
          select: {
            id: true,
            salesNo: true,
            customer: { select: { name: true } },
            items: {
              select: {
                id: true,
                itemId: true,
                quantity: true,
                unitPrice: true,
                makingEntries: { select: { id: true, name: true, unitPrice: true, quantity: true } },
                item: { select: { itemName: true } },
              },
            },
          },
        },
        entity: { select: { id: true, name: true } },
      },
    }).catch((err) => {
      console.error('TailorPayment query error:', err);
      throw err;
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Get tailor payments error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}

// POST create new tailor payment (partial payment allowed)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'tailorPayment', 'create')) {
      // For backward-compat: if menu doesn't exist in user's permissions, allow admin/manager
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        return NextResponse.json(
          { error: 'You do not have permission to create tailor payments' },
          { status: 403 }
        );
      }
    }

    const { salesOrderId, tailorId, entityId, amount, paymentDate, paymentType, referenceNo, notes } =
      await request.json();

    if (!salesOrderId || !tailorId || !entityId || !amount) {
      return NextResponse.json(
        { error: 'Sales order, tailor, entity, and amount are required' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // Validate sales order exists
    const salesOrder = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: {
          include: {
            makingEntries: true,
          },
        },
      },
    });
    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // Validate tailor exists
    const tailor = await db.tailor.findUnique({ where: { id: tailorId } });
    if (!tailor) {
      return NextResponse.json({ error: 'Tailor not found' }, { status: 404 });
    }

    // Calculate total payable for this tailor on this sales order.
    // Payable = sum of (makingEntry.unitPrice × quantity) where making was done by this tailor.
    // ★ Since SalesMakingEntry doesn't currently have tailorId, we compute the FULL making
    //    total for the sales order and treat it as the tailor's payable (single-tailor assumption).
    //    This matches the existing Incentive model where each SalesOrder has a tailorId.
    //    If the user later adds tailorId to SalesMakingEntry, this can be refined.
    const totalMakingForSalesOrder = salesOrder.items.reduce(
      (sum, item) => sum + item.makingEntries.reduce((s, m) => s + m.unitPrice * m.quantity, 0),
      0
    );

    // Total already paid to this tailor for this sales order
    const existingPayments = await db.tailorPayment.aggregate({
      where: { salesOrderId, tailorId },
      _sum: { amount: true },
    });
    const alreadyPaid = existingPayments._sum.amount || 0;
    const remaining = totalMakingForSalesOrder - alreadyPaid;

    // Soft warning: allow overpayment but warn the user
    let warning: string | undefined;
    if (parsedAmount > remaining && remaining > 0) {
      warning = `Note: You are paying ${parsedAmount.toFixed(2)} but only ${remaining.toFixed(2)} remains payable. This will result in an overpayment of ${(parsedAmount - remaining).toFixed(2)}.`;
    } else if (remaining <= 0) {
      warning = `Note: This tailor has already been fully paid (${alreadyPaid.toFixed(2)}) for this sales order. Recording an additional payment of ${parsedAmount.toFixed(2)}.`;
    }

    const payment = await db.tailorPayment.create({
      data: {
        salesOrderId,
        tailorId,
        entityId,
        amount: parsedAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentType: paymentType || 'cash',
        referenceNo: referenceNo || null,
        notes: notes || null,
        createdBy: currentUser.id,
      },
      include: {
        tailor: { select: { id: true, name: true, phone: true } },
        salesOrder: { select: { id: true, salesNo: true, customer: { select: { name: true } } } },
        entity: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      payment,
      summary: {
        totalPayable: totalMakingForSalesOrder,
        totalPaid: alreadyPaid + parsedAmount,
        remaining: totalMakingForSalesOrder - (alreadyPaid + parsedAmount),
      },
      warning,
    });
  } catch (error) {
    console.error('Create tailor payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
