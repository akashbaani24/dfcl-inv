import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/incentive-formulas?status=active
// Returns all formulas with their assigned items
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;

    const formulas = await db.incentiveFormula.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { item: { select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    return NextResponse.json({ formulas });
  } catch (error) {
    console.error('Get incentive formulas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/incentive-formulas
// Body: { name, description, priceFrom, priceTo, commissionMap: {<entityName>: <amount>, default: <amount>}, status, notes, itemIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can create formulas' }, { status: 403 });
    }

    const { name, description, priceFrom, priceTo, commissionMap, status, notes, itemIds } = await request.json();
    if (!name) return NextResponse.json({ error: 'Formula name is required' }, { status: 400 });
    if (priceFrom === undefined || priceTo === undefined) {
      return NextResponse.json({ error: 'priceFrom and priceTo are required' }, { status: 400 });
    }
    if (parseFloat(priceFrom) > parseFloat(priceTo)) {
      return NextResponse.json({ error: 'priceFrom must be ≤ priceTo' }, { status: 400 });
    }

    // commissionMap can be either an object or already a JSON string
    const commissionMapStr = typeof commissionMap === 'string' ? commissionMap : JSON.stringify(commissionMap || {});

    const formula = await db.incentiveFormula.create({
      data: {
        name,
        description: description || null,
        priceFrom: parseFloat(priceFrom),
        priceTo: parseFloat(priceTo),
        commissionMap: commissionMapStr,
        status: status || 'active',
        notes: notes || null,
        createdBy: currentUser.id,
        items: itemIds && itemIds.length > 0 ? {
          create: itemIds.map((itemId: string) => ({ itemId }))
        } : undefined,
      },
      include: {
        items: { include: { item: { select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    return NextResponse.json({ formula });
  } catch (error) {
    console.error('Create incentive formula error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
