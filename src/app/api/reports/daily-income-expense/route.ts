import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { bdDate } from '@/lib/bd-time';

// GET /api/reports/daily-income-expense?entityId=xxx&days=30
// Returns daily income and expense for the last N days (default 30).
//
// Income sources:
//   - Sales order payments (amount collected)
//   - Supplier payments are NOT income — they're expenses
//
// Expense sources:
//   - Supplier payments (amount paid)
//   - Tailor payments (amount paid)
//   - Sales returns (refund amount, if approved)
//   - Item adjustments decrease (loss of stock value — approximate)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const days = parseInt(searchParams.get('days') || '30');

    // Build date range: last N days
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Determine entity filter
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({ dailyData: [], summary: { totalIncome: 0, totalExpense: 0, net: 0 } });
    }

    const entityFilter = entityId ? { entityId } : (userEntityIds ? { entityId: { in: userEntityIds } } : {});

    // Fetch sales payments (income)
    const salesPayments = await db.salesPayment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
        salesOrder: entityFilter.entityId ? { entityId: entityFilter.entityId } : (userEntityIds ? { entityId: { in: userEntityIds } } : {}),
      },
      select: { amount: true, paymentDate: true },
    });

    // Fetch supplier payments (expense)
    const supplierPayments = await db.supplierPayment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
        ...entityFilter,
      },
      select: { amount: true, paymentDate: true },
    });

    // Fetch tailor payments (expense)
    const tailorPayments = await db.tailorPayment.findMany({
      where: {
        paymentDate: { gte: startDate, lte: endDate },
        ...entityFilter,
      },
      select: { amount: true, paymentDate: true },
    });

    // Fetch approved sales returns (expense — refund)
    const salesReturns = await db.salesReturn.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'approved',
        ...(entityFilter.entityId ? { entityId: entityFilter.entityId } : (userEntityIds ? { entityId: { in: userEntityIds } } : {})),
      },
      select: { price: true, quantity: true, createdAt: true },
    });

    // Build daily map
    const dailyMap = new Map<string, { date: string; income: number; expense: number }>();

    // Helper to add to a day
    const addToDay = (date: Date, type: 'income' | 'expense', amount: number) => {
      const dayKey = bdDate(date); // "DD Mon YYYY"
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { date: dayKey, income: 0, expense: 0 });
      }
      const entry = dailyMap.get(dayKey)!;
      entry[type] += amount;
    };

    // Populate
    for (const p of salesPayments) addToDay(new Date(p.paymentDate), 'income', p.amount);
    for (const p of supplierPayments) addToDay(new Date(p.paymentDate), 'expense', p.amount);
    for (const p of tailorPayments) addToDay(new Date(p.paymentDate), 'expense', p.amount);
    for (const r of salesReturns) addToDay(new Date(r.createdAt), 'expense', r.price * r.quantity);

    // Convert to sorted array (oldest first)
    const dailyData = Array.from(dailyMap.values()).sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      return da.getTime() - db.getTime();
    });

    const totalIncome = dailyData.reduce((s, d) => s + d.income, 0);
    const totalExpense = dailyData.reduce((s, d) => s + d.expense, 0);

    return NextResponse.json({
      dailyData,
      summary: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        days,
      },
    });
  } catch (error) {
    console.error('Daily income/expense report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
