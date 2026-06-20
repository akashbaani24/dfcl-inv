import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { bdDate } from '@/lib/bd-time';

// GET /api/reports/cash-sales-summary?from=2026-06-01&to=2026-06-30&entityId=xxx
//
// Returns a daily sales summary per entity, combining:
//   1. Manual daily sales entries (AccountsEntry with entryType='sales')
//   2. Sales order payments (SalesPayment grouped by paymentType)
//
// Output: array of { entityName, date, cash, card, cheque, mobile, total }
// Plus a grand total row.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const fromStr = searchParams.get('from') || '';
    const toStr = searchParams.get('to') || '';

    // Default: last 30 days
    const endDate = toStr ? new Date(toStr) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    // Entity scoping
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ rows: [], grandTotal: { cash: 0, card: 0, cheque: 0, mobile: 0, total: 0 } });
    }

    const entityWhere = entityId ? { entityId } : (userEntityIds ? { entityId: { in: userEntityIds } } : {});

    // 1. Fetch manual daily sales entries
    const manualEntries = await db.accountsEntry.findMany({
      where: {
        entryType: 'sales',
        entryDate: { gte: startDate, lte: endDate },
        ...entityWhere,
      },
      include: { entity: { select: { name: true } } },
      orderBy: { entryDate: 'desc' },
    });

    // 2. Fetch sales order payments
    const salesPayments = await db.salesPayment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
        salesOrder: entityWhere,
      },
      include: {
        salesOrder: {
          select: { entityId: true, entity: { select: { name: true } } },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // 3. Aggregate into rows: key = entityId|date
    const rowMap = new Map<string, { entityName: string; date: string; cash: number; card: number; cheque: number; mobile: number }>();

    // Helper to add to a row
    const addToRow = (entityName: string, date: Date, cash: number, card: number, cheque: number, mobile: number) => {
      const dayKey = bdDate(date);
      const mapKey = `${entityName}|${dayKey}`;
      if (!rowMap.has(mapKey)) {
        rowMap.set(mapKey, { entityName, date: dayKey, cash: 0, card: 0, cheque: 0, mobile: 0 });
      }
      const row = rowMap.get(mapKey)!;
      row.cash += cash;
      row.card += card;
      row.cheque += cheque;
      row.mobile += mobile;
    };

    // Process manual entries
    for (const e of manualEntries) {
      addToRow(
        e.entity?.name || '—',
        new Date(e.entryDate),
        e.cashAmount,
        e.cardAmount,
        e.chequeAmount,
        e.mobileAmount
      );
    }

    // Process sales order payments — map paymentType to columns
    for (const p of salesPayments) {
      const entityName = p.salesOrder?.entity?.name || '—';
      const cash = p.paymentType === 'cash' ? p.amount : 0;
      const card = p.paymentType === 'card' ? p.amount : 0;
      const cheque = p.paymentType === 'cheque' ? p.amount : 0;
      const mobile = p.paymentType === 'mobile_banking' ? p.amount : 0;
      addToRow(entityName, new Date(p.paymentDate), cash, card, cheque, mobile);
    }

    // Convert to sorted array (newest first)
    const rows = Array.from(rowMap.values()).sort((a, b) => {
      if (a.entityName !== b.entityName) return a.entityName.localeCompare(b.entityName);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Grand total
    const grandTotal = rows.reduce((acc, r) => {
      acc.cash += r.cash;
      acc.card += r.card;
      acc.cheque += r.cheque;
      acc.mobile += r.mobile;
      acc.total += r.cash + r.card + r.cheque + r.mobile;
      return acc;
    }, { cash: 0, card: 0, cheque: 0, mobile: 0, total: 0 });

    // Add per-row total
    const rowsWithTotal = rows.map(r => ({ ...r, total: r.cash + r.card + r.cheque + r.mobile }));

    return NextResponse.json({
      rows: rowsWithTotal,
      grandTotal,
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    });
  } catch (error) {
    console.error('Cash sales summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
