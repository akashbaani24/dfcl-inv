import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMenu } from '@/lib/auth';
import { getStock } from '@/lib/stock-guard';

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

    if (!canMenu(currentUser, 'transfer', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create transfers' }, { status: 403 });
    }

    const { itemId, barcode, fromEntityId, toEntityId, quantity, batchId, notes } = await request.json();

    if (!itemId || !fromEntityId || !toEntityId || !quantity) {
      return NextResponse.json(
        { error: 'Item, from entity, to entity, and quantity are required' },
        { status: 400 }
      );
    }

    if (fromEntityId === toEntityId) {
      return NextResponse.json({ error: 'Source and destination entities cannot be the same' }, { status: 400 });
    }

    const qty = parseInt(quantity);

    // ★ If barcode is provided, validate that it belongs to this item
    //   (either as Item.barcode primary, or as an ItemBarcode row).
    if (barcode) {
      const itemRow = await db.item.findUnique({
        where: { id: itemId },
        select: { barcode: true, itemName: true },
      });
      if (!itemRow) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      // Accept if it matches the primary barcode OR exists as an additional barcode row
      if (itemRow.barcode !== barcode) {
        const itemBarcodeRow = await (db as any).itemBarcode.findFirst({
          where: { barcode, itemId },
          select: { id: true },
        });
        if (!itemBarcodeRow) {
          return NextResponse.json(
            { error: `Barcode "${barcode}" does not belong to item "${itemRow.itemName}".` },
            { status: 400 }
          );
        }
      }
    }

    // ★ STOCK GUARD — ensure source entity has enough stock (minus pending outbound transfers)
    // to cover this transfer. This prevents creating transfers that exceed available stock.
    const currentStock = await getStock(db, itemId, fromEntityId);

    // Sum of all pending outbound transfers for this item from this entity
    const pendingOutgoing = await db.transfer.aggregate({
      where: {
        itemId,
        fromEntityId,
        status: 'pending',
      },
      _sum: { quantity: true },
    });
    const pendingOutgoingQty = pendingOutgoing._sum.quantity || 0;
    const availableForNewTransfer = currentStock - pendingOutgoingQty;

    if (availableForNewTransfer < qty) {
      const itemRow = await db.item.findUnique({ where: { id: itemId }, select: { itemName: true } });
      return NextResponse.json(
        {
          error:
            `Insufficient stock at source entity for "${itemRow?.itemName || 'this item'}". ` +
            `Current stock: ${currentStock}, pending outgoing transfers: ${pendingOutgoingQty}, ` +
            `available for new transfer: ${availableForNewTransfer}, requested: ${qty}. ` +
            `Transfer not created — stock cannot go below 0.`,
        },
        { status: 400 }
      );
    }

    const transfer = await db.transfer.create({
      data: {
        itemId,
        barcode: barcode || null,
        fromEntityId,
        toEntityId,
        quantity: qty,
        status: 'pending',
        batchId: batchId || null,  // ★ groups multi-item transfers
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
