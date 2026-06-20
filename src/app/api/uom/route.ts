import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET all UoM (admin/manager only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const uomList = await db.uoM.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ uomList });
  } catch (error) {
    console.error('Get UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new UoM (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'UoM name is required' }, { status: 400 });
    }

    const existing = await db.uoM.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'UoM name already exists' }, { status: 400 });
    }

    const uom = await db.uoM.create({
      data: {
        name,
        description: description || '',
      },
    });

    return NextResponse.json({ uom });
  } catch (error) {
    console.error('Create UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
