import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const reasons = await db.bookingReason.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ reasons });
  } catch (error) {
    console.error('Get booking reasons error:', error);
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
    if (!name) return NextResponse.json({ error: 'Reason name is required' }, { status: 400 });

    const existing = await db.bookingReason.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: 'Reason already exists' }, { status: 400 });

    const reason = await db.bookingReason.create({
      data: { name, description: description || '', status: status || 'active' },
    });

    return NextResponse.json({ reason });
  } catch (error) {
    console.error('Create booking reason error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
