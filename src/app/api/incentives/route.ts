import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic, canMenu } from '@/lib/auth';

// GET all incentives
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
      return NextResponse.json({ incentives: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.entityId = entityId;
    } else if (userEntityIds) {
      where.entityId = { in: userEntityIds };
    }

    const incentives = await db.incentive.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        entity: true,
        tailor: true,
      },
    });

    return NextResponse.json({ incentives });
  } catch (error) {
    console.error('Get incentives error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new incentive
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMenu(currentUser, 'incentive', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create incentives' }, { status: 403 });
    }

    const { itemId, entityId, tailorId, amount, type, status, notes } = await request.json();

    if (!itemId || !entityId || amount === undefined || !type) {
      return NextResponse.json(
        { error: 'Item, entity, amount, and type are required' },
        { status: 400 }
      );
    }

    if (!['tailor', 'sales', 'bonus'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "tailor", "sales", or "bonus"' }, { status: 400 });
    }

    const incentive = await db.incentive.create({
      data: {
        itemId,
        entityId,
        tailorId: tailorId || null,
        amount: parseFloat(amount),
        type,
        status: status || 'pending',
        notes: notes || null,
        createdBy: currentUser.id,
      },
      include: {
        item: true,
        entity: true,
        tailor: true,
      },
    });

    return NextResponse.json({ incentive });
  } catch (error) {
    console.error('Create incentive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
