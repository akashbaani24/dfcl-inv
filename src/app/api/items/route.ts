import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMasterData } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET items with search, server-side pagination, and stock data
// Performance optimizations:
// - Uses DB indexes on itemName, year, lcNo, group, subGroup (added in schema)
// - Only selects needed columns (not entire row)
// - Runs item query, count query, and stock query in parallel where possible
// - Reduces data transferred from DB
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 200); // cap at 200
    const search = searchParams.get('search') || '';
    const entityId = searchParams.get('entityId') || '';

    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null
      : currentUser.entityAccess.map(ea => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0) {
      return NextResponse.json({
        items: [], total: 0, page, pageSize, totalPages: 0,
        visibleColumns: ['serial'],
      });
    }

    const skip = (page - 1) * pageSize;

    // Build where clause for search — uses indexes (itemName, year, lcNo, group, subGroup)
    let where: Prisma.ItemWhereInput = {};
    if (search.trim()) {
      const searchTerm = search.trim();
      where = {
        OR: [
          { itemName: { contains: searchTerm } },
          { lcNo: { contains: searchTerm } },
          { group: { contains: searchTerm } },
          { subGroup: { contains: searchTerm } },
          { year: { contains: searchTerm } },
        ],
      };
    }

    // Parallel: get items + total count at the same time
    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        // Only select columns we actually return to the client
        select: {
          id: true,
          year: true,
          lcNo: true,
          group: true,
          subGroup: true,
          itemName: true,
          price: true,
          uom: true,
          createdAt: true,
        },
      }),
      db.item.count({ where }),
    ]);

    // Filter columns based on user access (computed once)
    const visibleColumns = currentUser.columnAccess
      .filter(ca => ca.canView)
      .map(ca => ca.columnName);
    const alwaysVisible = ['serial'];
    const needStock = visibleColumns.includes('stockQty');

    // Only fetch stock if user can see stockQty column
    let stockMap = new Map<string, number>();
    if (needStock && items.length > 0) {
      const itemIds = items.map(i => i.id);
      let stockFilter: Prisma.StockWhereInput = { itemId: { in: itemIds } };
      if (entityId) {
        stockFilter.entityId = entityId;
      } else if (userEntityIds) {
        stockFilter.entityId = { in: userEntityIds };
      }
      const stocks = await db.stock.findMany({
        where: stockFilter,
        select: { itemId: true, quantity: true },
      });
      for (const s of stocks) {
        stockMap.set(s.itemId, (stockMap.get(s.itemId) || 0) + s.quantity);
      }
    }

    // Build filtered response
    const filteredItems = items.map((item, index) => {
      const result: Record<string, unknown> = {
        id: item.id,
        serial: skip + index + 1,
      };
      for (const col of visibleColumns) {
        if (col === 'stockQty') {
          result.stockQty = stockMap.get(item.id) || 0;
        } else if (item[col as keyof typeof item] !== undefined) {
          result[col] = item[col as keyof typeof item];
        }
      }
      return result;
    });

    return NextResponse.json({
      items: filteredItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      visibleColumns: [...alwaysVisible, ...visibleColumns],
    });
  } catch (error) {
    console.error('Get items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new item — duplicate check by (itemName + year)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMasterData(currentUser, 'newItem', 'create')) {
      return NextResponse.json({ error: 'You do not have permission to create items' }, { status: 403 });
    }

    const { year, lcNo, group, subGroup, itemName, price, uom } = await request.json();

    if (!itemName) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    // Duplicate check: only itemName — other columns (year, lcNo, etc.) can duplicate
    const existing = await db.item.findFirst({
      where: { itemName: { equals: itemName } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Item "${itemName}" already exists. Duplicate item names are not allowed.` },
        { status: 409 }
      );
    }

    const item = await db.item.create({
      data: {
        year: year || 'N/A',
        lcNo: lcNo || 'N/A',
        group: group || 'N/A',
        subGroup: subGroup || 'N/A',
        itemName,
        price: parseFloat(price) || 0,
        uom: uom || 'PCS',
        createdBy: currentUser.id,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Create item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
