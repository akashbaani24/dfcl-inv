import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update making info
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, cost, unit, status } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Process name is required' }, { status: 400 });
    }

    const info = await db.makingInfo.update({
      where: { id },
      data: {
        name,
        description: description || '',
        cost: cost ? parseFloat(cost) : 0,
        unit: unit || 'PCS',
        status: status || 'active',
      },
    });

    return NextResponse.json({ makingInfo: info });
  } catch (error) {
    console.error('Update making info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE making info
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    await db.makingInfo.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete making info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
