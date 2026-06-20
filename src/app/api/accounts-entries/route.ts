import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET /api/accounts-entries?entityId=xxx&entryType=sales&from=2026-01-01&to=2026-12-31
// Entity sees only their own entries. Admin/manager sees all (or filtered by entityId).
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const entryType = searchParams.get('entryType') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    // Entity isolation: non-admin/manager sees only their assigned entities
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ entries: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    else if (userEntityIds) where.entityId = { in: userEntityIds };
    if (entryType) where.entryType = entryType;
    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) { const endDate = new Date(to); endDate.setHours(23, 59, 59, 999); dateFilter.lte = endDate; }
      where.entryDate = dateFilter;
    }

    const entries = await db.accountsEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      include: { entity: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Get accounts entries error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts-entries
// Body for sales: { entityId, entryType: 'sales', entryDate, cashAmount, cardAmount, chequeAmount, mobileAmount, description }
// Body for income/expense: { entityId, entryType: 'income'|'expense', category, amount, paymentType, entryDate, description }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { entityId, entryType, category, cashAmount, cardAmount, chequeAmount, mobileAmount, amount, paymentType, entryDate, description } = body;

    if (!entityId) return NextResponse.json({ error: 'Entity is required' }, { status: 400 });
    if (!entryType || !['income', 'expense', 'sales'].includes(entryType)) {
      return NextResponse.json({ error: 'entryType must be "income", "expense", or "sales"' }, { status: 400 });
    }

    // Entity access check: non-admin/manager can only create entries for their own entities
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && !userEntityIds.includes(entityId)) {
      return NextResponse.json({ error: 'You can only create entries for your own entity' }, { status: 403 });
    }

    const entry = await db.accountsEntry.create({
      data: {
        entityId,
        entryType,
        category: category || (entryType === 'sales' ? 'daily_sales' : 'misc'),
        cashAmount: parseFloat(cashAmount) || 0,
        cardAmount: parseFloat(cardAmount) || 0,
        chequeAmount: parseFloat(chequeAmount) || 0,
        mobileAmount: parseFloat(mobileAmount) || 0,
        amount: parseFloat(amount) || 0,
        paymentType: paymentType || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        description: description || null,
        createdBy: currentUser.id,
      },
      include: { entity: { select: { name: true } } },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Create accounts entry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
