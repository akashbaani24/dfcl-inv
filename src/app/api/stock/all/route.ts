import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/stock/all?search=&group=&subGroup=&entityId=&page=1&pageSize=50
//
// Returns a flat list of (item × entity) stock rows with:
//   - entity name
//   - item name + itemCode + barcode + group + subGroup + uom + price
//   - quantity (Float — supports decimals like 0.5)
//
// Filters:
//   search   — LIKE search across itemName, itemCode, barcode
//   group    — exact match on item.group
//   subGroup — exact match on item.subGroup
//   entityId — restrict to one entity (optional)
//
// Permission:
//   admin/manager → can see any entity (or all if no entityId given)
//   regular user  → only entities in their entityAccess; if entityId is given
//                   and not in their access list, returns 403
//
// Response includes:
//   stocks: [...] — paginated rows
//   total: number — total rows matching the filter (for pagination)
//   totalsByEntity: [{ entityName, totalQty, totalValue }] — for the Total Stock summary
//   grandTotalQty: number — sum of qty across all matched rows
//   grandTotalValue: number — sum of (qty × price) across all matched rows
//   groups: [string] — distinct item.group values (for the Group dropdown)
//   subGroups: [string] — distinct item.subGroup values (for the Sub Group dropdown, optionally filtered by group)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const search = (sp.get('search') || '').trim();
    const group = (sp.get('group') || '').trim();
    const subGroup = (sp.get('subGroup') || '').trim();
    const entityId = (sp.get('entityId') || '').trim();
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get('pageSize') || '50')));
    const skip = (page - 1) * pageSize;

    // ── Permission: compute the list of entityIds this user can see ─────────
    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
    const userEntityIds: string[] | null = isPrivileged
      ? null
      : (currentUser.entityAccess || []).map((ea: any) => ea.entityId);

    if (!isPrivileged && userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({
        stocks: [], total: 0, page, pageSize, totalPages: 0,
        totalsByEntity: [], grandTotalQty: 0, grandTotalValue: 0,
        groups: [], subGroups: [],
      });
    }

    // If a specific entityId was requested, enforce access
    if (entityId && userEntityIds && !userEntityIds.includes(entityId)) {
      return NextResponse.json({ error: 'You do not have access to this entity' }, { status: 403 });
    }

    // ── Build the where clause ─────────────────────────────────────────────
    const stockWhere: Prisma.StockWhereInput = { quantity: { gt: 0 } };
    if (entityId) {
      stockWhere.entityId = entityId;
    } else if (userEntityIds) {
      stockWhere.entityId = { in: userEntityIds };
    }

    const itemFilters: Prisma.ItemWhereInput[] = [];
    if (search) {
      // LIKE search across multiple columns
      itemFilters.push(
        { itemName: { contains: search } },
        { itemCode: { contains: search } },
        { barcode: { contains: search } },
      );
    }
    if (group) itemFilters.push({ group: { equals: group } });
    if (subGroup) itemFilters.push({ subGroup: { equals: subGroup } });

    if (itemFilters.length > 0) {
      stockWhere.item = { AND: itemFilters };
    }

    // ── Run paginated query + count + totals in parallel ──────────────────
    const [stocks, total, totalsAgg, distinctGroups, distinctSubGroups] = await Promise.all([
      // Paginated rows
      db.stock.findMany({
        where: stockWhere,
        skip,
        take: pageSize,
        orderBy: [
          { entity: { name: 'asc' } },
          { item: { itemName: 'asc' } },
        ],
        select: {
          id: true,
          quantity: true,
          entity: { select: { id: true, name: true } },
          item: {
            select: {
              id: true,
              itemName: true,
              itemCode: true,
              barcode: true,
              group: true,
              subGroup: true,
              uom: true,
              price: true,
            },
          },
        },
      }),

      // Total count (for pagination UI)
      db.stock.count({ where: stockWhere }),

      // Aggregated totals per entity — uses _sum on quantity and (quantity × price).
      // Prisma can't multiply columns in _sum, so we fetch all matching rows
      // (just the qty + price + entityId) and aggregate in JS. This is fine
      // for ~700 stock rows; would need a SQL view for millions.
      db.stock.findMany({
        where: stockWhere,
        select: {
          quantity: true,
          entityId: true,
          entity: { select: { name: true } },
          item: { select: { price: true } },
        },
      }),

      // Distinct groups (for dropdown) — optionally filtered by current subGroup
      db.item.findMany({
        where: subGroup ? { subGroup: { equals: subGroup } } : {},
        distinct: ['group'],
        select: { group: true },
        orderBy: { group: 'asc' },
      }),

      // Distinct subGroups (for dropdown) — optionally filtered by current group
      db.item.findMany({
        where: group ? { group: { equals: group } } : {},
        distinct: ['subGroup'],
        select: { subGroup: true },
        orderBy: { subGroup: 'asc' },
      }),
    ]);

    // ── Compute totals by entity + grand totals ───────────────────────────
    const byEntity = new Map<string, { entityName: string; totalQty: number; totalValue: number }>();
    let grandTotalQty = 0;
    let grandTotalValue = 0;
    for (const r of totalsAgg) {
      const qty = r.quantity || 0;
      const price = r.item?.price || 0;
      const value = qty * price;
      grandTotalQty += qty;
      grandTotalValue += value;

      const eid = r.entityId;
      const ename = r.entity?.name || '—';
      const cur = byEntity.get(eid) || { entityName: ename, totalQty: 0, totalValue: 0 };
      cur.totalQty += qty;
      cur.totalValue += value;
      byEntity.set(eid, cur);
    }
    const totalsByEntity = Array.from(byEntity.values()).sort((a, b) =>
      a.entityName.localeCompare(b.entityName)
    );

    // ── Build response ────────────────────────────────────────────────────
    return NextResponse.json({
      stocks: stocks.map(s => ({
        id: s.id,
        entityId: s.entity.id,
        entityName: s.entity.name,
        itemId: s.item.id,
        itemName: s.item.itemName,
        itemCode: s.item.itemCode || '',
        barcode: s.item.barcode || '',
        group: s.item.group || '',
        subGroup: s.item.subGroup || '',
        uom: s.item.uom || 'PCS',
        unitPrice: s.item.price || 0,
        quantity: s.quantity,
        stockValue: s.quantity * (s.item.price || 0),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totalsByEntity,
      grandTotalQty,
      grandTotalValue,
      groups: distinctGroups.map((g: any) => g.group).filter(Boolean),
      subGroups: distinctSubGroups.map((s: any) => s.subGroup).filter(Boolean),
    });
  } catch (error: any) {
    console.error('Get stock-for-all error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
