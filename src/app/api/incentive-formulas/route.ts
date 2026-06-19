import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/incentive-formulas?status=active
// Returns all formulas with their ranges and assigned items
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
        ranges: { orderBy: { priceFrom: 'asc' } },
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
// Body: { name, description, status, notes, ranges: [{priceFrom, priceTo, outletCommission, headOfficeCommission}], itemIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can create formulas' }, { status: 403 });
    }

    const { name, description, status, notes, ranges, itemIds } = await request.json();
    if (!name) return NextResponse.json({ error: 'Formula name is required' }, { status: 400 });
    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
      return NextResponse.json({ error: 'At least one range is required' }, { status: 400 });
    }

    const formula = await db.incentiveFormula.create({
      data: {
        name,
        description: description || null,
        status: status || 'active',
        notes: notes || null,
        createdBy: currentUser.id,
        ranges: {
          create: ranges.map((r: any) => ({
            priceFrom: parseFloat(r.priceFrom),
            priceTo: parseFloat(r.priceTo),
            outletCommission: parseFloat(r.outletCommission) || 0,
            headOfficeCommission: parseFloat(r.headOfficeCommission) || 0,
          })),
        },
        items: itemIds && itemIds.length > 0 ? {
          create: itemIds.map((itemId: string) => ({ itemId }))
        } : undefined,
      },
      include: {
        ranges: { orderBy: { priceFrom: 'asc' } },
        items: { include: { item: { select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    return NextResponse.json({ formula });
  } catch (error) {
    console.error('Create incentive formula error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
