import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// GET /api/items/export — download all items as Excel (.xlsx) file
// Optional query params:
//   search=    — filter items by search term
//   entityId=  — filter stock by entity
//   format=xlsx (default) or csv
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const entityId = searchParams.get('entityId') || '';
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    // Build where clause for search
    let where: Record<string, unknown> = {};
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

    // Get all items (no pagination for export — user gets everything)
    const items = await db.item.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    });

    // Get stock data per item (respecting entity filter & user access)
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null
      : currentUser.entityAccess.map(ea => ea.entityId);

    let stockFilter: Record<string, unknown> = {};
    if (entityId) {
      stockFilter.entityId = entityId;
    } else if (userEntityIds) {
      stockFilter.entityId = { in: userEntityIds };
    }

    const itemIds = items.map(i => i.id);
    const stocks = await db.stock.findMany({
      where: { itemId: { in: itemIds }, ...stockFilter },
      select: { itemId: true, quantity: true },
    });

    // Aggregate stock per item
    const stockMap = new Map<string, number>();
    for (const s of stocks) {
      stockMap.set(s.itemId, (stockMap.get(s.itemId) || 0) + s.quantity);
    }

    // Get entities for reference (so we can show which entity the stock is for)
    const entities = await db.entity.findMany({
      select: { id: true, name: true },
    });
    const entityMap = new Map(entities.map(e => [e.id, e.name]));

    // Determine which entity the stock belongs to (if filtered)
    const entityName = entityId ? (entityMap.get(entityId) || 'Unknown') : 'All Accessible';

    // Build rows
    const rows = items.map((item, index) => ({
      'Serial': index + 1,
      'Year': item.year,
      'LC No': item.lcNo,
      'Group': item.group,
      'Sub Group': item.subGroup,
      'Item Name': item.itemName,
      'Price': item.price,
      'UoM': item.uom,
      'Stock Qty': stockMap.get(item.id) || 0,
      'Stock Entity': entityName,
      'Created At': new Date(item.createdAt).toISOString().split('T')[0],
    }));

    // Generate file
    const fileName = `items-export-${new Date().toISOString().split('T')[0]}`;
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },   // Serial
      { wch: 8 },   // Year
      { wch: 18 },  // LC No
      { wch: 18 },  // Group
      { wch: 18 },  // Sub Group
      { wch: 35 },  // Item Name
      { wch: 12 },  // Price
      { wch: 8 },   // UoM
      { wch: 12 },  // Stock Qty
      { wch: 20 },  // Stock Entity
      { wch: 14 },  // Created At
    ];

    if (format === 'csv') {
      // CSV format
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      });
    }

    // Default: XLSX format
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');

    // Add a summary sheet
    const summary = [
      { 'Metric': 'Total Items', 'Value': items.length },
      { 'Metric': 'Total Stock Quantity', 'Value': rows.reduce((s, r) => s + (r['Stock Qty'] as number), 0) },
      { 'Metric': 'Total Stock Value', 'Value': rows.reduce((s, r) => s + (r['Stock Qty'] as number) * (r['Price'] as number), 0) },
      { 'Metric': 'Export Date', 'Value': new Date().toISOString() },
      { 'Metric': 'Exported By', 'Value': currentUser.displayName },
      { 'Metric': 'Entity Filter', 'Value': entityName },
      { 'Metric': 'Search Filter', 'Value': search || 'None' },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summary);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Write to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error('Item export error:', error);
    return NextResponse.json(
      { error: 'Export failed: ' + (error instanceof Error ? error.message : 'unknown error') },
      { status: 500 }
    );
  }
}
