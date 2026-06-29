import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// GET /api/broker-commissions
// Returns all broker commissions, optionally filtered by paidStatus or date range.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const paidStatus = sp.get('paidStatus') || '';

    const where: any = {};
    if (paidStatus) where.paidStatus = paidStatus;

    const commissions = await db.brokerCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ commissions });
  } catch (error: any) {
    console.error('Get broker commissions error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}

// POST /api/broker-commissions — create a new broker commission entry
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'brokerCommission', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create broker commissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      brokerName, brokerContact, brokerAddress,
      salesOrderId, orderDate, salesPersonName,
      commissionAmount, commissionType, commissionRate,
      paymentType, paymentDetails,
      paidStatus, deliveryStatus,
      checkedBy, approvedBy,
    } = body;

    if (!brokerName) {
      return NextResponse.json({ error: 'Broker name is required' }, { status: 400 });
    }

    // Calculate commission amount if percentage type
    let finalAmount = parseFloat(commissionAmount) || 0;
    if (commissionType === 'percentage' && commissionRate) {
      // If salesOrderId is provided, fetch the sales order total and calculate
      if (salesOrderId) {
        const so = await db.salesOrder.findUnique({
          where: { id: salesOrderId },
          select: { items: { select: { quantity: true, unitPrice: true } }, discount: true },
        });
        if (so) {
          const grossTotal = so.items.reduce((sum: number, si: any) =>
            sum + (si.quantity || 0) * (si.unitPrice || 0), 0);
          const discount = so.discount || 0;
          const orderTotal = grossTotal - discount;
          finalAmount = (orderTotal * parseFloat(commissionRate)) / 100;
        }
      }
    }

    const commission = await db.brokerCommission.create({
      data: {
        brokerName: brokerName.trim(),
        brokerContact: brokerContact || null,
        brokerAddress: brokerAddress || null,
        salesOrderId: salesOrderId || null,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        salesPersonName: salesPersonName || null,
        commissionAmount: finalAmount,
        commissionType: commissionType || 'amount',
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
        paymentType: paymentType || 'cash',
        paymentDetails: paymentDetails || null,
        paidStatus: paidStatus || 'unpaid',
        deliveryStatus: deliveryStatus || 'pending',
        checkedBy: checkedBy || null,
        approvedBy: approvedBy || null,
        createdBy: currentUser.id,
      },
    });

    return NextResponse.json({ commission });
  } catch (error: any) {
    console.error('Create broker commission error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
