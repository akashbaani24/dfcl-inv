import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, status } = await request.json();
    if (!name) return NextResponse.json({ error: 'Reason name is required' }, { status: 400 });

    const existing = await db.bookingReason.findFirst({ where: { name, NOT: { id } } });
    if (existing) return NextResponse.json({ error: 'Reason name already exists' }, { status: 400 });

    const reason = await db.bookingReason.update({
      where: { id },
      data: { name, description: description ?? undefined, status: status ?? undefined },
    });

    return NextResponse.json({ reason });
  } catch (error) {
    console.error('Update booking reason error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await db.bookingReason.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete booking reason error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
