import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update UoM
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'UoM name is required' }, { status: 400 });
    }

    const existing = await db.uoM.findUnique({ where: { name } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'UoM name already exists' }, { status: 400 });
    }

    const uom = await db.uoM.update({
      where: { id },
      data: {
        name,
        description: description || '',
      },
    });

    return NextResponse.json({ uom });
  } catch (error) {
    console.error('Update UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE UoM
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    await db.uoM.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
