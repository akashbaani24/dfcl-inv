import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/stock/by-entity?entityId=xxx
// Returns stock entries for one entity (or all entities the user has access to)
// along with booking counts per item-entity pair so the UI can show "Booked: N" next to stock.
//
// ★ v60-fix92: Returns ONE ROW PER BARCODE (not per item).
//   - For each (item, entity), we look up all ItemBarcode rows for that entity.
//     Each row has its own (barcode, qty) — these are shown as separate rows.
//   - For items with NO ItemBarcode rows at this entity (legacy items where only
//     Stock table was used), we fall back to showing one row with Item.barcode +
//     Stock.quantity (the aggregate).
//   - This matches the user's mental model: "je barcode diye stock entry korsi,
//     sei barcode ei stock dekha uchit, not the old primary barcode."
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

    // Build stock filter (aggregate table — one row per item × entity)
    const stockWhere: Prisma.StockWhereInput = {};
    if (entityId) {
      stockWhere.entityId = entityId;
    } else if (userEntityIds) {
      stockWhere.entityId = { in: userEntityIds };
    }

    // ★ Hide zero-or-negative stock rows — user request:
    //    "kono barcode e jodi stock zero hoye jay, ta stock e jeno show na kore."
    stockWhere.quantity = { gt: 0 };

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

    // Fetch aggregate stocks with item + entity
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

    // ============================================================
    // ★ v60-fix92: Fetch ItemBarcode rows for the same (item, entity) pairs
    // so we can show ONE ROW PER BARCODE instead of one aggregate row.
    // ============================================================
    // Build a set of (itemId, entityId) keys we care about, then fetch all
    // ItemBarcode rows matching those keys (with qty > 0).
    const itemEntityPairs = stocks.map(s => ({ itemId: s.itemId, entityId: s.entityId }));
    const itemIds = Array.from(new Set(itemEntityPairs.map(p => p.itemId)));
    const entityIds = Array.from(new Set(itemEntityPairs.map(p => p.entityId)));

    let itemBarcodeRows: any[] = [];
    try {
      itemBarcodeRows = await (db as any).itemBarcode.findMany({
        where: {
          itemId: { in: itemIds },
          entityId: { in: entityIds },
          quantity: { gt: 0 },
        },
        select: {
          id: true,
          itemId: true,
          entityId: true,
          barcode: true,
          quantity: true,
        },
      });
    } catch (e) {
      // ItemBarcode table may not exist on this DB yet — fall back to aggregate-only view
      console.error('ItemBarcode query failed (table may not exist):', e);
      itemBarcodeRows = [];
    }

    // Build a map: `${itemId}|${entityId}` → array of { barcode, quantity }
    const barcodeMap = new Map<string, Array<{ barcode: string; quantity: number }>>();
    for (const ib of itemBarcodeRows) {
      const key = `${ib.itemId}|${ib.entityId}`;
      const arr = barcodeMap.get(key) || [];
      arr.push({ barcode: ib.barcode, quantity: ib.quantity });
      barcodeMap.set(key, arr);
    }

    // Fetch booking counts per (itemId, fromEntityId) for "pending" or "active" bookings
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
        forEntityName: bi.booking.entityId,
      });
      bookingMap.set(key, existing);
    }

    // Resolve entity names for bookings
    const allEntityIdsForBookings = new Set<string>();
    bookingItems.forEach(bi => allEntityIdsForBookings.add(bi.booking.entityId));
    const entityRecords = await db.entity.findMany({
      where: { id: { in: Array.from(allEntityIdsForBookings) } },
      select: { id: true, name: true },
    });
    const entityNameMap = new Map(entityRecords.map(e => [e.id, e.name]));

    // ============================================================
    // ★ Build response — ONE ROW PER BARCODE
    // ============================================================
    // For each (item, entity) stock row, check if there are ItemBarcode rows:
    //   - If YES → emit one row per ItemBarcode, each with its own barcode + qty
    //   - If NO  → emit one row using Item.barcode + Stock.quantity (legacy fallback)
    const result: any[] = [];
    for (const s of stocks) {
      const key = `${s.itemId}|${s.entityId}`;
      const booking = bookingMap.get(key);
      const bookingInfo = {
        bookedQty: booking?.qty || 0,
        bookings: booking ? booking.bookings.map(b => ({
          bookingNo: b.bookingNo,
          tillDate: b.tillDate,
          forEntityName: entityNameMap.get(b.forEntityName) || '—',
        })) : [],
      };

      const perBarcodeRows = barcodeMap.get(key);
      if (perBarcodeRows && perBarcodeRows.length > 0) {
        // ★ Per-barcode view — one row per barcode
        for (const pbr of perBarcodeRows) {
          result.push({
            id: `${s.id}-${pbr.barcode}`,  // synthetic id to keep React keys unique
            itemId: s.itemId,
            entityId: s.entityId,
            entityName: s.entity.name,
            quantity: pbr.quantity,  // per-barcode qty
            item: {
              itemName: s.item.itemName,
              barcode: pbr.barcode,  // ★ the SPECIFIC barcode (not the primary)
              itemCode: s.item.itemCode,
              group: s.item.group,
              subGroup: s.item.subGroup,
              uom: s.item.uom || 'PCS',
              year: s.item.year,
            },
            ...bookingInfo,
          });
        }
      } else {
        // ★ Legacy fallback — item has no ItemBarcode rows at this entity.
        //   Show one row with the primary Item.barcode + Stock.quantity.
        result.push({
          id: s.id,
          itemId: s.itemId,
          entityId: s.entityId,
          entityName: s.entity.name,
          quantity: s.quantity,  // aggregate qty
          item: {
            itemName: s.item.itemName,
            barcode: s.item.barcode,  // primary barcode
            itemCode: s.item.itemCode,
            group: s.item.group,
            subGroup: s.item.subGroup,
            uom: s.item.uom || 'PCS',
            year: s.item.year,
          },
          ...bookingInfo,
        });
      }
    }

    // Sort: entity name asc, then item name asc, then barcode asc (so multiple barcodes of
    // the same item group together nicely).
    result.sort((a, b) => {
      if (a.entityName !== b.entityName) return a.entityName.localeCompare(b.entityName);
      if (a.item.itemName !== b.item.itemName) return a.item.itemName.localeCompare(b.item.itemName);
      return (a.item.barcode || '').localeCompare(b.item.barcode || '');
    });

    return NextResponse.json({ stocks: result });
  } catch (error) {
    console.error('Get stock by entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
