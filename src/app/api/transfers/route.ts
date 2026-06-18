import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET all transfers
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
      return NextResponse.json({ transfers: [] });
    }

    const where: Record<string, unknown> = {};
    if (entityId) {
      where.OR = [{ fromEntityId: entityId }, { toEntityId: entityId }];
    } else if (userEntityIds) {
      where.OR = [
        { fromEntityId: { in: userEntityIds } },
        { toEntityId: { in: userEntityIds } },
      ];
    }

    const transfers = await db.transfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true,
        fromEntity: true,
        toEntity: true,
      },
    });

    return NextResponse.json({ transfers });
  } catch (error) {
    console.error('Get transfers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new transfer
// Transfers are always created as "pending" — stock is NOT touched at creation time.
// Stock moves from source → destination only when the destination entity creates a Receive
// (see /api/receives POST). This implements the requirement:
//   "Nijer stock theke onno joner entity te transfer korle ta jeno oi entity receive korar por nijer entity theke minus hoy."
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to modify items' }, { status: 403 });
    }

    const { itemId, fromEntityId, toEntityId, quantity, notes } = await request.json();

    if (!itemId || !fromEntityId || !toEntityId || !quantity) {
      return NextResponse.json(
        { error: 'Item, from entity, to entity, and quantity are required' },
        { status: 400 }
      );
    }

    if (fromEntityId === toEntityId) {
      return NextResponse.json({ error: 'Source and destination entities cannot be the same' }, { status: 400 });
    }

    const transfer = await db.transfer.create({
      data: {
        itemId,
        fromEntityId,
        toEntityId,
        quantity: parseInt(quantity),
        status: 'pending',
        notes: notes || null,
        createdBy: currentUser.id,
      },
      include: {
        item: true,
        fromEntity: true,
        toEntity: true,
      },
    });

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('Create transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
