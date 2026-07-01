import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // ★ Load the order first to check delivery status — delivered orders are locked.
    // (Payment collection is still allowed for delivered orders — money may come in later.)
    const existingOrder = await db.salesOrder.findUnique({
      where: { id },
      select: { status: true, deliveryStatus: true },
    });
    if (!existingOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }
    const isDelivered = existingOrder.deliveryStatus === 'delivered' || existingOrder.status === 'delivered';
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

    // Handle payment addition separately — allowed even for delivered orders (money may come in later)
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

    // ★ For any other update (status, delivery status, items), the order must NOT be delivered.
    // Admins can bypass this lock (for fixing mistakes).
    if (isDelivered && !isAdmin) {
      return NextResponse.json(
        {
          error: 'This sales order has already been delivered and is locked. Modifications are not allowed for regular users. Contact an admin if a change is needed.',
          deliveryStatus: existingOrder.deliveryStatus,
          status: existingOrder.status,
        },
        { status: 403 }
      );
    }

    // Handle status update
    if (body.status) {
      // ★ Block "Mark Complete" if not all items delivered AND payment not cleared
      if (body.status === 'delivered' || body.status === 'completed') {
        const fullOrder = await db.salesOrder.findUnique({
          where: { id },
          include: {
            items: { select: { id: true, quantity: true, item: { select: { itemName: true } } } },
            payments: { select: { amount: true } },
            deliveries: { include: { items: { select: { salesOrderItemId: true, quantity: true } } } },
          },
        });
        if (fullOrder) {
          // Check delivery: sum delivered per sales order item
          const delivered = new Map<string, number>();
          for (const d of fullOrder.deliveries) {
            for (const di of d.items) {
              delivered.set(di.salesOrderItemId, (delivered.get(di.salesOrderItemId) || 0) + di.quantity);
            }
          }
          const allDelivered = fullOrder.items.every(si => (delivered.get(si.id) || 0) >= si.quantity);
          // Check payment
          const totalPaid = fullOrder.payments.reduce((s, p) => s + p.amount, 0);
          // Compute grand total (need items' unit price + making entries) MINUS discount
          const fullItems = await db.salesOrderItem.findMany({
            where: { salesOrderId: id },
            include: { makingEntries: true },
          });
          const grossTotal = fullItems.reduce((s, si) => s + si.quantity * si.unitPrice + (si.makingEntries.reduce((m, me) => m + me.quantity * me.unitPrice, 0)), 0);
          // ★ v60-fix98: subtract discount — otherwise "payment cleared" check fails when a discount was applied.
          //   Before: grandTotal = grossTotal (ignores discount) → user could overpay and still get "not cleared" error.
          //   After: grandTotal = grossTotal - discount → matches what the UI shows and what user actually owes.
          const discount = (fullOrder as any).discount || 0;
          const grandTotal = grossTotal - discount;
          const paymentCleared = totalPaid >= grandTotal - 0.01; // small tolerance for float rounding

          if (!allDelivered) {
            return NextResponse.json(
              { error: 'Cannot mark as complete — not all items have been fully delivered yet. Complete all deliveries first.' },
              { status: 400 }
            );
          }
          if (!paymentCleared) {
            return NextResponse.json(
              { error: `Cannot mark as complete — payment not cleared. Total: ${grandTotal.toFixed(2)}, paid: ${totalPaid.toFixed(2)}, due: ${(grandTotal - totalPaid).toFixed(2)}. Collect the due amount first.` },
              { status: 400 }
            );
          }
        }
      }
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

    // ★ Block deletion of delivered orders (non-admin)
    const existingOrder = await db.salesOrder.findUnique({
      where: { id },
      select: { status: true, deliveryStatus: true },
    });
    if (!existingOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }
    const isDelivered = existingOrder.deliveryStatus === 'delivered' || existingOrder.status === 'delivered';
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
    if (isDelivered && !isAdmin) {
      return NextResponse.json(
        { error: 'This sales order has been delivered and cannot be deleted. Contact an admin if needed.' },
        { status: 403 }
      );
    }

    await db.salesOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sales order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
