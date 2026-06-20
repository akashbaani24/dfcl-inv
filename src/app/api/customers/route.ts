import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET all customers — GLOBAL (no entity scoping).
// Any authenticated user can see all customers.
// Includes the createdByEntity relation so the UI can show "Created at: <entity name>".
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const customers = await db.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        createdByEntity: { select: { name: true } },
      },
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new customer — GLOBAL.
// createdByEntityId is taken from the request body (the working entity at the time of creation).
// Once created, the customer is visible to all entities.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name, phone, email, address, type, status, createdByEntityId } = await request.json();

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
        createdByEntityId: createdByEntityId || null,
        createdBy: currentUser.id,
      },
      include: {
        createdByEntity: { select: { name: true } },
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
