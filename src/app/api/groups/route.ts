import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const groups = await db.group.findMany({
      include: { _count: { select: { subGroups: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
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

    const { name, description, status } = await request.json();
    if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 });

    const existing = await db.group.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });

    const group = await db.group.create({
      data: { name, description: description || '', status: status || 'active' },
    });

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
