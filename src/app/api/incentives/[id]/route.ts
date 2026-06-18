import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';

// PUT update incentive
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'incentive', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to edit incentives' }, { status: 403 });
    }

    const { id } = await params;
    const { itemId, entityId, tailorId, amount, type, status, notes } = await request.json();

    if (type && !['tailor', 'sales', 'bonus'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "tailor", "sales", or "bonus"' }, { status: 400 });
    }

    const incentive = await db.incentive.update({
      where: { id },
      data: {
        ...(itemId && { itemId }),
        ...(entityId && { entityId }),
        ...(tailorId !== undefined && { tailorId: tailorId || null }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(type && { type }),
        ...(status && { status }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        item: true,
        entity: true,
        tailor: true,
      },
    });

    return NextResponse.json({ incentive });
  } catch (error) {
    console.error('Update incentive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE incentive
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can delete' }, { status: 403 });
    }

    const { id } = await params;
    await db.incentive.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete incentive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
