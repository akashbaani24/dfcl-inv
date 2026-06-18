import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET stock data - returns items with stock quantities for selected entity
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const entityId = searchParams.get('entityId') || '';

    // Get user's accessible entities - admin and manager see all
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null
      : currentUser.entityAccess.map(ea => ea.entityId);

    if (userEntityIds && userEntityIds.length === 0 && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        visibleColumns: ['serial'],
      });
    }

    // ★ Requirement #1: enforce entity access — non-admin/manager cannot query an entity they don't have access to
    if (entityId && userEntityIds && !userEntityIds.includes(entityId)) {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        visibleColumns: ['serial'],
      });
    }

    const skip = (page - 1) * pageSize;

    // Build where clause
    let where: Prisma.ItemWhereInput = {};
    if (search.trim()) {
      const searchTerm = search.trim();
      where = {
        ...where,
        OR: [
          { itemName: { contains: searchTerm } },
          { lcNo: { contains: searchTerm } },
          { group: { contains: searchTerm } },
          { subGroup: { contains: searchTerm } },
          { year: { contains: searchTerm } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.item.count({ where }),
    ]);

    // Get stock data for the selected entity (or all entities)
    let stockFilter: Prisma.StockWhereInput = {};
    if (entityId) {
      stockFilter.entityId = entityId;
    } else if (userEntityIds) {
      stockFilter.entityId = { in: userEntityIds };
    }

    // Get all relevant stocks
    const itemIds = items.map(i => i.id);
    const stocks = await db.stock.findMany({
      where: {
        itemId: { in: itemIds },
        ...stockFilter,
      },
    });

    // Calculate stock per item
    const stockMap = new Map<string, number>();
    for (const s of stocks) {
      const existing = stockMap.get(s.itemId) || 0;
      stockMap.set(s.itemId, existing + s.quantity);
    }

    // Filter columns based on user access
    const userColumnAccess = currentUser.columnAccess;
    const visibleColumns = userColumnAccess
      .filter(ca => ca.canView)
      .map(ca => ca.columnName);

    const alwaysVisible = ['serial'];

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
    console.error('Get stock/items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create or update stock entry
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to modify stock' }, { status: 403 });
    }

    const { itemId, entityId, quantity } = await request.json();

    if (!itemId || !entityId || quantity === undefined) {
      return NextResponse.json({ error: 'Item, entity, and quantity are required' }, { status: 400 });
    }

    // Upsert stock
    const stock = await db.stock.upsert({
      where: {
        itemId_entityId: { itemId, entityId },
      },
      update: { quantity: parseInt(quantity) },
      create: { itemId, entityId, quantity: parseInt(quantity) },
    });

    return NextResponse.json({ stock });
  } catch (error) {
    console.error('Create/update stock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
