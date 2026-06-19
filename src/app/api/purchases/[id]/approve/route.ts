import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// POST /api/purchases/[id]/approve
//
// Approves a pending purchase. This ONLY sets purchase.status = "approved".
// It does NOT create Receive entries and does NOT hit stock.
// After approval, the purchase appears in the Receive page where the user
// must manually receive each item (which hits stock + creates barcode).
//
// Permission: needs 'purchaseApproval' menu's 'approve' permission
//   (admin/manager always pass)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // ★ v59: Approval requires the 'purchaseApproval' menu's 'approve' permission
    if (!canMenu(currentUser, 'purchaseApproval', 'approve')) {
      return NextResponse.json({ error: 'You do not have permission to approve purchases. Only users with approval rights can approve.' }, { status: 403 });
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

    // ★ Only update the status — NO auto-receive, NO stock hit.
    // The user must go to the Receive page and manually receive items.
    await db.purchase.update({
      where: { id },
      data: { status: 'approved' },
    });

    return NextResponse.json({
      success: true,
      message: `Purchase approved. Items are now ready to be received via the Receive page. Stock will be updated when items are received.`,
    });
  } catch (error) {
    console.error('Approve purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
