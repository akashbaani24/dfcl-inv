import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// POST /api/purchases/[id]/approve
//
// Approves a pending purchase. This:
//   1. Sets purchase.status = "approved"
//   2. Creates a Receive entry for each purchase item (entityId = purchase.entityId)
//   3. Each Receive increments the entity's stock for that item
//
// Permission: needs 'purchaseApproval' menu's 'edit' permission
//   (admin/manager always pass)
//
// After approval, the purchase appears as "approved" in the list, and the items
// appear in the Receive page with their purchaseId set. From there, the user
// can print barcodes for all received items via the receive page's barcode print button.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Approval requires the 'purchaseApproval' menu's edit permission
    if (!canMenu(currentUser, 'purchaseApproval', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to approve purchases' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.purchase.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Purchase is already "${existing.status}". Only pending purchases can be approved.` }, { status: 400 });
    }

    // Atomic: update status + create receives + increment stock
    const result = await db.$transaction(async (tx) => {
      // 1. Update purchase status
      await tx.purchase.update({
        where: { id },
        data: { status: 'approved' },
      });

      // 2. Create Receive entries + increment stock for each purchase item
      const createdReceives = [];
      for (const pi of existing.items) {
        const receive = await tx.receive.create({
          data: {
            itemId: pi.itemId,
            entityId: existing.entityId,
            quantity: pi.quantity,
            purchaseId: existing.id,
            referenceNo: existing.purchaseNo,
            notes: `Auto-created from purchase ${existing.purchaseNo} (${pi.uom})`,
            createdBy: currentUser.id,
          },
          include: {
            item: { select: { itemName: true, barcode: true } },
          },
        });
        createdReceives.push(receive);

        // Increment stock for the receiving entity
        const stockEntry = await tx.stock.findUnique({
          where: { itemId_entityId: { itemId: pi.itemId, entityId: existing.entityId } },
        });
        const newQty = (stockEntry?.quantity || 0) + pi.quantity;
        await tx.stock.upsert({
          where: { itemId_entityId: { itemId: pi.itemId, entityId: existing.entityId } },
          update: { quantity: newQty },
          create: { itemId: pi.itemId, entityId: existing.entityId, quantity: newQty },
        });
      }

      return { receiveCount: createdReceives.length, receives: createdReceives };
    });

    return NextResponse.json({
      success: true,
      message: `Purchase approved. ${result.receiveCount} item(s) received into ${existing.entityId}.`,
      receiveCount: result.receiveCount,
      receiveIds: result.receives.map(r => r.id),
    });
  } catch (error) {
    console.error('Approve purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
