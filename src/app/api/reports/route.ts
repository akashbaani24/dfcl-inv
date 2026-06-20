import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET aggregated report data.
// Query params:
//   entityId  - limit to a single entity (admin/manager can pass any; users limited to their access)
//   from      - ISO date string (inclusive) - default: 30 days ago
//   to        - ISO date string (inclusive) - default: now
//   type      - "all" | "stock" | "sales" | "transfer" | "adjustment" | "incentive" - default "all"
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const type = searchParams.get('type') || 'all';

    // Date window (default last 30 days)
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }
    // End of day for `to`
    to.setHours(23, 59, 59, 999);

    // Entity scoping (admins/managers see all; users see only their entities)
    const userEntityIds =
      currentUser.role === 'admin' || currentUser.role === 'manager'
        ? null
        : currentUser.entityAccess.map((ea) => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json(emptyReport());
    }

    const entityFilter = (field: string) => {
      const f: Record<string, unknown> = {};
      if (entityId) f[field] = entityId;
      else if (userEntityIds) f[field] = { in: userEntityIds };
      return f;
    };

    const dateFilter = (field: string) => ({
      [field]: { gte: from, lte: to },
    });

    const result: Record<string, unknown> = { from: from.toISOString(), to: to.toISOString() };

    if (type === 'all' || type === 'stock') {
      // Current stock snapshot (no date filter - stock is point-in-time)
      const stockWhere: Record<string, unknown> = {};
      if (entityId) stockWhere.entityId = entityId;
      else if (userEntityIds) stockWhere.entityId = { in: userEntityIds };

      const stocks = await db.stock.findMany({
        where: stockWhere,
        include: { item: { select: { itemName: true, uom: true, price: true } }, entity: { select: { name: true } } },
      });

      const totalQty = stocks.reduce((s, x) => s + x.quantity, 0);
      const totalValue = stocks.reduce((s, x) => s + x.quantity * (x.item?.price || 0), 0);

      // Top 10 items by stock value
      const byItem = new Map<string, { itemId: string; itemName: string; qty: number; value: number; uom: string }>();
      for (const s of stocks) {
        const cur = byItem.get(s.itemId) || { itemId: s.itemId, itemName: s.item?.itemName || '-', qty: 0, value: 0, uom: s.item?.uom || 'PCS' };
        cur.qty += s.quantity;
        cur.value += s.quantity * (s.item?.price || 0);
        byItem.set(s.itemId, cur);
      }
      const topItems = [...byItem.values()].sort((a, b) => b.value - a.value).slice(0, 10);

      // Stock per entity
      const byEntity = new Map<string, { entityName: string; qty: number; value: number }>();
      for (const s of stocks) {
        const cur = byEntity.get(s.entityId) || { entityName: s.entity?.name || '-', qty: 0, value: 0 };
        cur.qty += s.quantity;
        cur.value += s.quantity * (s.item?.price || 0);
        byEntity.set(s.entityId, cur);
      }
      const entityStock = [...byEntity.values()].sort((a, b) => b.value - a.value);

      // Low stock (qty <= 5)
      const lowStock = [...byItem.values()].filter((x) => x.qty <= 5).sort((a, b) => a.qty - b.qty);

      result.stock = {
        totalItems: byItem.size,
        totalQty,
        totalValue,
        topItems,
        entityStock,
        lowStock,
      };
    }

    if (type === 'all' || type === 'sales') {
      const where = { ...entityFilter('entityId'), ...dateFilter('createdAt') };
      const [orders, returns] = await Promise.all([
        db.salesOrder.findMany({
          where,
          include: {
            entity: true,
            customer: true,
            items: { include: { item: true, makingEntries: true } },
            payments: { select: { amount: true } },
          },
        }),
        db.salesReturn.findMany({
          where,
          include: { item: { select: { itemName: true, uom: true } }, entity: { select: { name: true } }, customer: { select: { name: true } } },
        }),
      ]);

      // ★ v60: Compute revenue from SalesOrderItem[] (multi-item orders)
      const computeOrderTotal = (o: any) => {
        const subTotal = (o.items || []).reduce((s: number, si: any) => s + (si.quantity || 0) * (si.unitPrice || 0), 0);
        const makingTotal = (o.items || []).reduce((s: number, si: any) =>
          s + (si.makingEntries || []).reduce((m: number, me: any) => m + (me.quantity || 0) * (me.unitPrice || 0), 0), 0);
        return subTotal + makingTotal - (o.discount || 0);
      };
      const computeOrderUnits = (o: any) => (o.items || []).reduce((s: number, si: any) => s + (si.quantity || 0), 0);

      const grossRevenue = orders.reduce((s, o) => s + computeOrderTotal(o), 0);
      const returnsValue = returns.reduce((s, r) => s + r.quantity * r.price, 0);
      const netRevenue = grossRevenue - returnsValue;
      const totalUnitsSold = orders.reduce((s, o) => s + computeOrderUnits(o), 0);
      const totalUnitsReturned = returns.reduce((s, r) => s + r.quantity, 0);

      // Group by day for trend chart
      const trend = aggregateByDay(orders, (o: any) => o.createdAt, (o: any) => computeOrderTotal(o));
      const returnsTrend = aggregateByDay(returns, (r) => r.createdAt, (r) => r.quantity * r.price);

      // By status
      const byStatus = countBy(orders, (o: any) => o.status);

      // By customer
      const byCustomer = topN(
        groupSum(orders, (o: any) => o.customerId, (o: any) => ({ name: o.customer?.name || '-', value: computeOrderTotal(o) })),
        10
      );

      // By item — flatten all SalesOrderItems across orders
      const itemMap = new Map<string, { name: string; value: number; qty: number }>();
      for (const o of orders) {
        for (const si of (o.items || [])) {
          const key = si.itemId;
          const cur = itemMap.get(key) || { name: si.item?.itemName || '-', value: 0, qty: 0 };
          cur.value += (si.quantity || 0) * (si.unitPrice || 0);
          cur.qty += si.quantity || 0;
          itemMap.set(key, cur);
        }
      }
      const byItem = topN(Array.from(itemMap.values()).map((v, i) => ({ key: String(i), ...v })), 10);

      result.sales = {
        orderCount: orders.length,
        returnCount: returns.length,
        grossRevenue,
        returnsValue,
        netRevenue,
        totalUnitsSold,
        totalUnitsReturned,
        trend: mergeTrends(trend, returnsTrend),
        byStatus,
        byCustomer,
        byItem,
        recentOrders: orders.slice(0, 20).map((o: any) => ({
          id: o.id,
          salesNo: o.salesNo || '-',
          itemName: (o.items || []).map((si: any) => si.item?.itemName || '-').join(', ') || '-',
          entityName: o.entity?.name || '-',
          customerName: o.customer?.name || '-',
          quantity: computeOrderUnits(o),
          price: 0,
          makingCharge: 0,
          total: computeOrderTotal(o),
          status: o.status,
          createdAt: o.createdAt,
        })),
      };
    }

    if (type === 'all' || type === 'transfer') {
      const transfers = await db.transfer.findMany({
        where: entityId
          ? { OR: [{ fromEntityId: entityId }, { toEntityId: entityId }], createdAt: { gte: from, lte: to } }
          : userEntityIds
            ? { OR: [{ fromEntityId: { in: userEntityIds } }, { toEntityId: { in: userEntityIds } }], createdAt: { gte: from, lte: to } }
            : { createdAt: { gte: from, lte: to } },
        include: { item: { select: { itemName: true } }, fromEntity: { select: { name: true } }, toEntity: { select: { name: true } } },
      });

      const totalQty = transfers.reduce((s, t) => s + t.quantity, 0);
      const byStatus = countBy(transfers, (t) => t.status);
      const byFromEntity = topN(
        groupSum(transfers, (t) => t.fromEntityId, (t) => ({ name: t.fromEntity?.name || '-', value: t.quantity })),
        10
      );
      const byToEntity = topN(
        groupSum(transfers, (t) => t.toEntityId, (t) => ({ name: t.toEntity?.name || '-', value: t.quantity })),
        10
      );
      const trend = aggregateByDay(transfers, (t) => t.createdAt, (t) => t.quantity);

      result.transfer = {
        totalCount: transfers.length,
        totalQty,
        byStatus,
        byFromEntity,
        byToEntity,
        trend,
        recent: transfers.slice(0, 20).map((t) => ({
          id: t.id,
          itemName: t.item?.itemName || '-',
          fromEntity: t.fromEntity?.name || '-',
          toEntity: t.toEntity?.name || '-',
          quantity: t.quantity,
          status: t.status,
          createdAt: t.createdAt,
        })),
      };
    }

    if (type === 'all' || type === 'adjustment') {
      const where = { ...entityFilter('entityId'), ...dateFilter('createdAt') };
      const adjustments = await db.itemAdjustment.findMany({
        where,
        include: { item: { select: { itemName: true, uom: true, price: true } }, entity: { select: { name: true } } },
      });

      const totalIncrease = adjustments.filter((a) => a.adjustmentType === 'increase').reduce((s, a) => s + a.quantity, 0);
      const totalDecrease = adjustments.filter((a) => a.adjustmentType === 'decrease').reduce((s, a) => s + a.quantity, 0);
      const byType = countBy(adjustments, (a) => a.adjustmentType);
      const byEntity = topN(
        groupSum(adjustments, (a) => a.entityId, (a) => ({ name: a.entity?.name || '-', value: a.quantity })),
        10
      );
      const trend = aggregateByDay(adjustments, (a) => a.createdAt, (a) => a.quantity);

      result.adjustment = {
        totalCount: adjustments.length,
        totalIncrease,
        totalDecrease,
        byType,
        byEntity,
        trend,
        recent: adjustments.slice(0, 20).map((a) => ({
          id: a.id,
          itemName: a.item?.itemName || '-',
          entityName: a.entity?.name || '-',
          adjustmentType: a.adjustmentType,
          quantity: a.quantity,
          reason: a.reason,
          createdAt: a.createdAt,
        })),
      };
    }

    if (type === 'all' || type === 'incentive') {
      const where = { ...entityFilter('entityId'), ...dateFilter('createdAt') };
      const incentives = await db.incentive.findMany({
        where,
        include: { item: { select: { itemName: true } }, entity: { select: { name: true } }, tailor: { select: { name: true } } },
      });

      const totalAmount = incentives.reduce((s, i) => s + i.amount, 0);
      const paidAmount = incentives.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
      const pendingAmount = incentives.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
      const byType = countBy(incentives, (i) => i.type);
      const byStatus = countBy(incentives, (i) => i.status);
      const byTailor = topN(
        incentives
          .filter((i) => i.tailorId)
          .reduce((acc, i) => {
            const key = i.tailorId!;
            const cur = acc.get(key) || { name: i.tailor?.name || '-', value: 0, count: 0 };
            cur.value += i.amount;
            cur.count += 1;
            acc.set(key, cur);
            return acc;
          }, new Map<string, { name: string; value: number; count: number }>()),
        10,
        (v) => v.value
      );
      const trend = aggregateByDay(incentives, (i) => i.createdAt, (i) => i.amount);

      result.incentive = {
        totalCount: incentives.length,
        totalAmount,
        paidAmount,
        pendingAmount,
        byType,
        byStatus,
        byTailor,
        trend,
        recent: incentives.slice(0, 20).map((i) => ({
          id: i.id,
          itemName: i.item?.itemName || '-',
          entityName: i.entity?.name || '-',
          tailorName: i.tailor?.name || '-',
          amount: i.amount,
          type: i.type,
          status: i.status,
          createdAt: i.createdAt,
        })),
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------- helpers ----------
function emptyReport() {
  return {
    from: null,
    to: null,
    stock: null,
    sales: null,
    transfer: null,
    adjustment: null,
    incentive: null,
  };
}

function aggregateByDay<T>(items: T[], getDate: (x: T) => Date, getValue: (x: T) => number) {
  const map = new Map<string, { date: string; value: number; count: number }>();
  for (const item of items) {
    const d = getDate(item);
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) || { date: key, value: 0, count: 0 };
    cur.value += getValue(item);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeTrends(a: { date: string; value: number; count: number }[], b: { date: string; value: number; count: number }[]) {
  const map = new Map<string, { date: string; revenue: number; returns: number }>();
  for (const x of a) {
    const cur = map.get(x.date) || { date: x.date, revenue: 0, returns: 0 };
    cur.revenue += x.value;
    map.set(x.date, cur);
  }
  for (const x of b) {
    const cur = map.get(x.date) || { date: x.date, revenue: 0, returns: 0 };
    cur.returns += x.value;
    map.set(x.date, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function countBy<T>(items: T[], getKey: (x: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = getKey(item);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

function groupSum<T, V>(items: T[], getKey: (x: T) => string, getValue: (x: T) => V): Map<string, V> {
  const map = new Map<string, V>();
  for (const item of items) {
    const k = getKey(item);
    const v = getValue(item);
    map.set(k, v);
  }
  return map;
}

function topN<V>(
  source: Map<string, V> | V[],
  n: number,
  sortFn?: (v: V) => number
): V[] {
  let arr: V[];
  if (Array.isArray(source)) arr = source;
  else arr = [...source.values()];
  if (sortFn) arr = arr.sort((a, b) => (sortFn(b) as number) - (sortFn(a) as number));
  else arr = arr.sort((a, b) => ((b as { value?: number }).value ?? 0) - ((a as { value?: number }).value ?? 0));
  return arr.slice(0, n);
}
