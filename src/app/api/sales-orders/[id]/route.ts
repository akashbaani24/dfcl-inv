import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Handle payment addition separately
    if (body.addPayment) {
      const now = new Date();
      const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const random = Math.floor(1000 + Math.random() * 9000).toString();
      const receiptNo = `MR-${dateStr}-${random}`;

      const payment = await db.salesPayment.create({
        data: {
          salesOrderId: id,
          receiptNo,
          amount: parseFloat(body.addPayment.amount) || 0,
          paymentType: body.addPayment.paymentType || 'cash',
          paymentMode: body.addPayment.paymentMode || 'collection',
          paymentDate: body.addPayment.paymentDate ? new Date(body.addPayment.paymentDate) : new Date(),
          chequeNo: body.addPayment.chequeNo || null,
          bankName: body.addPayment.bankName || null,
          notes: body.addPayment.notes || null,
          createdBy: currentUser.id,
        },
      });

      return NextResponse.json({ payment });
    }

    // Handle status update
    if (body.status) {
      const salesOrder = await db.salesOrder.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json({ salesOrder });
    }

    // Handle delivery status update
    if (body.deliveryStatus !== undefined) {
      const updateData: Record<string, unknown> = { deliveryStatus: body.deliveryStatus };
      if (body.deliveryPerson !== undefined) updateData.deliveryPerson = body.deliveryPerson;
      if (body.deliveryNotes !== undefined) updateData.deliveryNotes = body.deliveryNotes;
      const salesOrder = await db.salesOrder.update({ where: { id }, data: updateData });
      return NextResponse.json({ salesOrder });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await db.salesOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
