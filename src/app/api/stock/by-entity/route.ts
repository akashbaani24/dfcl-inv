import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/stock/by-entity?entityId=xxx
// Returns raw stock entries for one entity (or all entities the user has access to)
// along with booking counts per item-entity pair so the UI can show "Booked: N" next to stock.
//
// Permissions:
//   - admin/manager → can see any entity (or all if no entityId given)
//   - regular user  → only entities in their entityAccess; if entityId is given and not in their list, returns 403
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const search = searchParams.get('search') || '';

    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
    const userEntityIds = isPrivileged ? null : currentUser.entityAccess.map(ea => ea.entityId);

    if (!isPrivileged && userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ stocks: [] });
    }

    // ★ Enforce entity access: if entityId is given and user doesn't have access → 403
    if (entityId && userEntityIds && !userEntityIds.includes(entityId)) {
      return NextResponse.json({ error: 'You do not have access to this entity' }, { status: 403 });
    }

    // Build stock filter
    const stockWhere: Prisma.StockWhereInput = {};
    if (entityId) {
      stockWhere.entityId = entityId;
    } else if (userEntityIds) {
      stockWhere.entityId = { in: userEntityIds };
    }

    if (search.trim()) {
      stockWhere.item = {
        OR: [
          { itemName: { contains: search } },
          { barcode: { contains: search } },
          { itemCode: { contains: search } },
          { group: { contains: search } },
          { subGroup: { contains: search } },
        ],
      };
    }

    // Fetch stocks with item + entity
    const stocks = await db.stock.findMany({
      where: stockWhere,
      include: {
        item: {
          select: {
            id: true,
            itemName: true,
            barcode: true,
            itemCode: true,
            group: true,
            subGroup: true,
            uom: true,
            year: true,
          },
        },
        entity: { select: { id: true, name: true } },
      },
      orderBy: [{ entity: { name: 'asc' } }, { item: { itemName: 'asc' } }],
    });

    // Fetch booking counts per (itemId, fromEntityId) for "pending" or "active" bookings
    // A booking is "active" if status is pending or processing (not cancelled/delivered)
    // and tillDate is in the future (or null = no expiry).
    const now = new Date();
    const bookingItems = await db.bookingItem.findMany({
      where: {
        booking: {
          status: { in: ['pending', 'processing'] },
          OR: [{ tillDate: null }, { tillDate: { gte: now } }],
        },
      },
      select: {
        itemId: true,
        fromEntityId: true,
        quantity: true,
        booking: { select: { entityId: true, bookingNo: true, status: true, tillDate: true } },
      },
    });

    // Aggregate: key = `${itemId}|${fromEntityId}` → total booked qty
    const bookingMap = new Map<string, { qty: number; bookings: { bookingNo: string; tillDate: Date | null; forEntityName: string }[] }>();
    for (const bi of bookingItems) {
      const key = `${bi.itemId}|${bi.fromEntityId}`;
      const existing = bookingMap.get(key) || { qty: 0, bookings: [] };
      existing.qty += bi.quantity;
      existing.bookings.push({
        bookingNo: bi.booking.bookingNo,
        tillDate: bi.booking.tillDate,
        forEntityName: bi.booking.entityId, // we'll resolve name below
      });
      bookingMap.set(key, existing);
    }

    // Resolve entity names for bookings
    const allEntityIds = new Set<string>();
    bookingItems.forEach(bi => allEntityIds.add(bi.booking.entityId));
    const entityRecords = await db.entity.findMany({
      where: { id: { in: Array.from(allEntityIds) } },
      select: { id: true, name: true },
    });
    const entityNameMap = new Map(entityRecords.map(e => [e.id, e.name]));

    // Build response
    const result = stocks.map(s => {
      const key = `${s.itemId}|${s.entityId}`;
      const booking = bookingMap.get(key);
      return {
        id: s.id,
        itemId: s.itemId,
        entityId: s.entityId,
        entityName: s.entity.name,
        quantity: s.quantity,
        item: {
          itemName: s.item.itemName,
          barcode: s.item.barcode,
          itemCode: s.item.itemCode,
          group: s.item.group,
          subGroup: s.item.subGroup,
          uom: s.item.uom || 'PCS',
          year: s.item.year,
        },
        bookedQty: booking?.qty || 0,
        bookings: booking ? booking.bookings.map(b => ({
          bookingNo: b.bookingNo,
          tillDate: b.tillDate,
          forEntityName: entityNameMap.get(b.forEntityName) || '—',
        })) : [],
      };
    });

    return NextResponse.json({ stocks: result });
  } catch (error) {
    console.error('Get stock by entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
