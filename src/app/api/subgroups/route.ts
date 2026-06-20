import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const groupId = searchParams.get('groupId');

    const where = groupId ? { groupId } : {};
    const subGroups = await db.subGroup.findMany({
      where,
      include: { group: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ subGroups });
  } catch (error) {
    console.error('Get subgroups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, groupId, description, status } = await request.json();
    if (!name || !groupId) return NextResponse.json({ error: 'SubGroup name and Group are required' }, { status: 400 });

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 400 });

    const existing = await db.subGroup.findFirst({ where: { name, groupId } });
    if (existing) return NextResponse.json({ error: 'SubGroup already exists under this Group' }, { status: 400 });

    const subGroup = await db.subGroup.create({
      data: { name, groupId, description: description || '', status: status || 'active' },
      include: { group: { select: { name: true } } },
    });

    return NextResponse.json({ subGroup });
  } catch (error) {
    console.error('Create subgroup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
