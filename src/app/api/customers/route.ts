import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all customers (admin/manager only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const customers = await db.customer.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new customer (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, phone, email, address, type, status } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const customer = await db.customer.create({
      data: {
        name,
        phone: phone || '',
        email: email || '',
        address: address || '',
        type: type || 'regular',
        status: status || 'active',
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
