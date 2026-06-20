import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all making info (admin/manager only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const makingInfo = await db.makingInfo.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ makingInfo });
  } catch (error) {
    console.error('Get making info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new making info (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description, cost, unit, status } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Process name is required' }, { status: 400 });
    }

    const info = await db.makingInfo.create({
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
    console.error('Create making info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
