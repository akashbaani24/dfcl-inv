import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/incentive-formulas/[id] — formula detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const formula = await db.incentiveFormula.findUnique({
      where: { id },
      include: {
        items: { include: { item: { select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } } } },
        incentives: { include: { item: { select: { itemName: true } }, entity: { select: { name: true } } }, take: 50, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!formula) return NextResponse.json({ error: 'Formula not found' }, { status: 404 });
    return NextResponse.json({ formula });
  } catch (error) {
    console.error('Get formula error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/incentive-formulas/[id] — update formula + sync item assignments
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can edit formulas' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, priceFrom, priceTo, commissionMap, status, notes, itemIds } = body;

    const existing = await db.incentiveFormula.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Formula not found' }, { status: 404 });

    // If itemIds provided, replace all assignments
    if (itemIds !== undefined) {
      await db.incentiveFormulaItem.deleteMany({ where: { formulaId: id } });
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        await db.incentiveFormulaItem.createMany({
          data: itemIds.map((itemId: string) => ({ formulaId: id, itemId })),
          skipDuplicates: true,
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (priceFrom !== undefined) updateData.priceFrom = parseFloat(priceFrom);
    if (priceTo !== undefined) updateData.priceTo = parseFloat(priceTo);
    if (commissionMap !== undefined) {
      updateData.commissionMap = typeof commissionMap === 'string' ? commissionMap : JSON.stringify(commissionMap || {});
    }
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const formula = await db.incentiveFormula.update({
      where: { id },
      data: updateData,
      include: {
        items: { include: { item: { select: { id: true, itemName: true, barcode: true, itemCode: true, uom: true } } } },
      },
    });

    return NextResponse.json({ formula });
  } catch (error) {
    console.error('Update formula error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/incentive-formulas/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can delete formulas' }, { status: 403 });
    }

    const { id } = await params;
    await db.incentiveFormula.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete formula error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
