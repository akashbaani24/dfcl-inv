import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/delete-all?confirm=YES_DELETE_ALL_STOCK
//
// ⚠️ DANGEROUS — deletes ALL stock rows across ALL entities.
// Only admin/manager can call this. The 'confirm' query param must equal
// 'YES_DELETE_ALL_STOCK' as a safety against accidental calls.
//
// Used when the admin wants to start fresh with a clean stock table
// (e.g. before bulk-uploading a fresh daily stock count).
//
// Does NOT delete:
//   - Items (master table stays intact)
//   - Entities
//   - SalesOrders, Deliveries, Transfers, etc.
// Only the Stock rows are removed.
//
// Response: { success, deleted, message }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Permission: ADMIN ONLY — this is a highly destructive operation.
    // Per user's explicit request: "kebol admin" (only admin).
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can delete all stock.' },
        { status: 403 }
      );
    }

    // Safety confirm param
    const confirm = request.nextUrl.searchParams.get('confirm');
    if (confirm !== 'YES_DELETE_ALL_STOCK') {
      return NextResponse.json(
        { error: 'Missing or incorrect confirm param. Add ?confirm=YES_DELETE_ALL_STOCK to confirm.' },
        { status: 400 }
      );
    }

    // Count before delete (for the response message)
    const before = await db.stock.count();

    // Delete all stock rows
    const result = await db.stock.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: result.count,
      beforeCount: before,
      message: `Deleted ${result.count} stock rows. All entities now have zero stock. Items, entities, sales orders, deliveries, etc. are NOT affected. Ready for fresh stock upload.`,
    });
  } catch (error: any) {
    console.error('Delete-all stock error:', error);
    return NextResponse.json(
      { error: 'Delete failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
