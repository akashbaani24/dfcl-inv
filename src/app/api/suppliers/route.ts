import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all suppliers (admin/manager only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const suppliers = await db.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('Get suppliers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new supplier (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, phone, email, address, status } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        phone: phone || '',
        email: email || '',
        address: address || '',
        status: status || 'active',
      },
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
