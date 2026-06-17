import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all entities
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const entities = await db.entity.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { stocks: true, userAccess: true } } },
    });

    return NextResponse.json({ entities });
  } catch (error) {
    console.error('Get entities error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new entity (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Entity name is required' }, { status: 400 });
    }

    const existing = await db.entity.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Entity name already exists' }, { status: 400 });
    }

    const entity = await db.entity.create({
      data: { name, description: description || null },
    });

    return NextResponse.json({ entity });
  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
