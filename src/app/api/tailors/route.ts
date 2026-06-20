import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET all tailors
// Optional query: ?entityId=xxx → returns tailors assigned to that entity (or with empty entityIds = available to all)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';

    const tailors = await db.tailor.findMany({
      orderBy: { name: 'asc' },
    });

    // If entityId provided, filter: tailor is available if entityIds is empty OR includes the entityId
    const filtered = entityId
      ? tailors.filter(t => {
          const ids = (t.entityIds || '').split(',').map(s => s.trim()).filter(Boolean)
          return ids.length === 0 || ids.includes(entityId)
        })
      : tailors

    return NextResponse.json({ tailors: filtered });
  } catch (error) {
    console.error('Get tailors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new tailor (admin/manager only)
// Body: { name, phone, address, specialization, status, entityIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, phone, address, specialization, status, entityIds } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tailor name is required' }, { status: 400 });
    }

    // entityIds: array of entity IDs → comma-separated string
    const entityIdsStr = Array.isArray(entityIds)
      ? entityIds.filter(Boolean).join(',')
      : '';

    const tailor = await db.tailor.create({
      data: {
        name,
        phone: phone || '',
        address: address || '',
        specialization: specialization || '',
        status: status || 'active',
        entityIds: entityIdsStr,
      },
    });

    return NextResponse.json({ tailor });
  } catch (error) {
    console.error('Create tailor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
