import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';
import { applyStockDelta, StockGuardError } from '@/lib/stock-guard';

// GET all item adjustments
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';

    // Get user's accessible entities - admin and manager see all
    const userEntityIds =
      currentUser.role === 'admin' || currentUser.role === 'manager'
        ? null
        : currentUser.entityAccess.map((ea) => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ itemAdjustments: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.entityId = entityId;
    } else if (userEntityIds) {
      where.entityId = { in: userEntityIds };
    }

    const itemAdjustments = await db.itemAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        entity: true,
      },
    });

    return NextResponse.json({ itemAdjustments });
  } catch (error) {
    console.error('Get item adjustments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new item adjustment
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'itemAdjustment', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create adjustments' }, { status: 403 });
    }

    const { itemId, entityId, adjustmentType, quantity, reason } = await request.json();

    if (!itemId || !entityId || !adjustmentType || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Item, entity, adjustment type, quantity, and reason are required' },
        { status: 400 }
      );
    }

    if (!['increase', 'decrease'].includes(adjustmentType)) {
      return NextResponse.json({ error: 'Adjustment type must be "increase" or "decrease"' }, { status: 400 });
    }

    const itemAdjustment = await db.itemAdjustment.create({
      data: {
        itemId,
        entityId,
        adjustmentType,
        quantity: parseInt(quantity),
        reason,
        createdBy: currentUser.id,
      },
      include: {
        item: true,
        entity: true,
      },
    });

    // Update stock accordingly — using stock guard to prevent negative stock
    const stockDelta = adjustmentType === 'increase' ? parseInt(quantity) : -parseInt(quantity);

    try {
      await applyStockDelta(db, itemId, entityId, stockDelta);
    } catch (e) {
      if (e instanceof StockGuardError) {
        // Roll back the adjustment record we just created
        await db.itemAdjustment.delete({ where: { id: itemAdjustment.id } }).catch(() => {});
        return NextResponse.json(
          {
            error: `Cannot decrease stock below 0. Current stock: ${e.currentQty}, attempted to decrease by ${Math.abs(e.attemptedDelta)}.`,
          },
          { status: 400 }
        );
      }
      throw e;
    }

    return NextResponse.json({ itemAdjustment });
  } catch (error) {
    console.error('Create item adjustment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
