import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update tailor — accepts entityIds (array) and stores as comma-separated string
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, phone, address, specialization, status, entityIds } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tailor name is required' }, { status: 400 });
    }

    const entityIdsStr = Array.isArray(entityIds)
      ? entityIds.filter(Boolean).join(',')
      : entityIds !== undefined ? String(entityIds || '') : undefined;

    const tailor = await db.tailor.update({
      where: { id },
      data: {
        name,
        phone: phone || '',
        address: address || '',
        specialization: specialization || '',
        status: status || 'active',
        ...(entityIdsStr !== undefined && { entityIds: entityIdsStr }),
      },
    });

    return NextResponse.json({ tailor });
  } catch (error) {
    console.error('Update tailor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE tailor
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    await db.tailor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete tailor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
