import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET /api/accounts-categories?entryType=income
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const entryType = request.nextUrl.searchParams.get('entryType') || '';
    const where: Record<string, unknown> = {};
    if (entryType) where.entryType = entryType;

    const categories = await db.accountsCategory.findMany({
      where,
      orderBy: [{ entryType: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get accounts categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create new category (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admin/manager can create categories' }, { status: 403 });
    }

    const { name, entryType, description } = await request.json();
    if (!name || !entryType) return NextResponse.json({ error: 'Name and entryType are required' }, { status: 400 });
    if (!['income', 'expense'].includes(entryType)) {
      return NextResponse.json({ error: 'entryType must be "income" or "expense"' }, { status: 400 });
    }

    const existing = await db.accountsCategory.findUnique({ where: { name_entryType: { name, entryType } } });
    if (existing) return NextResponse.json({ error: 'Category already exists' }, { status: 400 });

    const category = await db.accountsCategory.create({
      data: { name, entryType, description: description || '' },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Create accounts category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
