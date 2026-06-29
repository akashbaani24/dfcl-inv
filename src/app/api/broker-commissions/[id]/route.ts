import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// GET /api/broker-commissions/[id] — fetch a single broker commission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { id } = await params;

    const commission = await db.brokerCommission.findUnique({ where: { id } });
    if (!commission) {
      return NextResponse.json({ error: 'Broker commission not found' }, { status: 404 });
    }
    return NextResponse.json({ commission });
  } catch (error: any) {
    console.error('Get broker commission error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}

// PUT /api/broker-commissions/[id] — update an existing broker commission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!canMenu(currentUser, 'brokerCommission', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to update broker commissions' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const {
      brokerName, brokerContact, brokerAddress,
      salesOrderId, orderDate, salesPersonName,
      commissionAmount, commissionType, commissionRate,
      paymentType, paymentDetails,
      paidStatus, deliveryStatus,
      checkedBy, approvedBy,
    } = body;

    // Verify existence
    const existing = await db.brokerCommission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Broker commission not found' }, { status: 404 });
    }

    // Calculate commission amount if percentage type
    let finalAmount = commissionAmount !== undefined ? parseFloat(commissionAmount) || 0 : existing.commissionAmount;
    if (commissionType === 'percentage' && commissionRate !== undefined) {
      const soId = salesOrderId || existing.salesOrderId;
      if (soId) {
        const so = await db.salesOrder.findUnique({
          where: { id: soId },
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

    const updated = await db.brokerCommission.update({
      where: { id },
      data: {
        brokerName: brokerName !== undefined ? brokerName.trim() : existing.brokerName,
        brokerContact: brokerContact !== undefined ? (brokerContact || null) : existing.brokerContact,
        brokerAddress: brokerAddress !== undefined ? (brokerAddress || null) : existing.brokerAddress,
        salesOrderId: salesOrderId !== undefined ? (salesOrderId || null) : existing.salesOrderId,
        orderDate: orderDate ? new Date(orderDate) : existing.orderDate,
        salesPersonName: salesPersonName !== undefined ? (salesPersonName || null) : existing.salesPersonName,
        commissionAmount: finalAmount,
        commissionType: commissionType || existing.commissionType,
        commissionRate: commissionRate !== undefined ? (commissionRate ? parseFloat(commissionRate) : null) : existing.commissionRate,
        paymentType: paymentType || existing.paymentType,
        paymentDetails: paymentDetails !== undefined ? (paymentDetails || null) : existing.paymentDetails,
        paidStatus: paidStatus || existing.paidStatus,
        deliveryStatus: deliveryStatus || existing.deliveryStatus,
        checkedBy: checkedBy !== undefined ? (checkedBy || null) : existing.checkedBy,
        approvedBy: approvedBy !== undefined ? (approvedBy || null) : existing.approvedBy,
      },
    });

    return NextResponse.json({ commission: updated });
  } catch (error: any) {
    console.error('Update broker commission error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}

// DELETE /api/broker-commissions/[id] — delete a broker commission
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!canMenu(currentUser, 'brokerCommission', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to delete broker commissions' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.brokerCommission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Broker commission not found' }, { status: 404 });
    }

    await db.brokerCommission.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error('Delete broker commission error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
