import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all tailors (admin/manager only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const tailors = await db.tailor.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ tailors });
  } catch (error) {
    console.error('Get tailors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new tailor (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, phone, address, specialization, status } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tailor name is required' }, { status: 400 });
    }

    const tailor = await db.tailor.create({
      data: {
        name,
        phone: phone || '',
        address: address || '',
        specialization: specialization || '',
        status: status || 'active',
      },
    });

    return NextResponse.json({ tailor });
  } catch (error) {
    console.error('Create tailor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
