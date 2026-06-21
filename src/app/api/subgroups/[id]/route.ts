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
    const { name, groupId, description, status } = await request.json();
    if (!name) return NextResponse.json({ error: 'SubGroup name is required' }, { status: 400 });

    const data: Record<string, unknown> = { name };
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (groupId) {
      const group = await db.group.findUnique({ where: { id: groupId } });
      if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 400 });
      data.groupId = groupId;
    }

    const subGroup = await db.subGroup.update({ where: { id }, data, include: { group: { select: { name: true } } } });
    return NextResponse.json({ subGroup });
  } catch (error) {
    console.error('Update subgroup error:', error);
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
    await db.subGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete subgroup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
