import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/bulk-delete
//
// Body: { stockIds: string[] }   — array of Stock.id values to delete
//
// Used by the "Remove" button on the Stock for All page (single row or multi-select).
// Also used to remove stock entirely when daily count = 0.
//
// Permission:
//   admin/manager always pass.
//   regular user needs canMenu(user, 'stockForAll' | 'myEntityStock', 'delete').
//   Non-privileged users can only delete stock rows for entities they have access to.
//
// Response: { success, deleted, skipped, errors }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager';
    const hasDeletePermission = isPrivileged
      || !!(currentUser.menuAccess?.find((m: any) =>
        (m.menuKey === 'stockForAll' || m.menuKey === 'myEntityStock') &&
        m.visible &&
        (m.canDelete ?? currentUser.canModifyItem ?? false)
      ));
    if (!hasDeletePermission) {
      return NextResponse.json(
        { error: 'You do not have permission to delete stock. Ask admin to grant Delete on Stock for All or My Entity Stock.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { stockIds } = body;
    if (!Array.isArray(stockIds) || stockIds.length === 0) {
      return NextResponse.json({ error: 'stockIds must be a non-empty array' }, { status: 400 });
    }

    // If non-privileged, fetch the stock rows first and verify entity access.
    let idsToDelete = stockIds;
    if (!isPrivileged) {
      const rows = await db.stock.findMany({
        where: { id: { in: stockIds } },
        select: { id: true, entityId: true },
      });
      const allowedIds = rows
        .filter(r => currentUser.entityAccess?.some((ea: any) => ea.entityId === r.entityId))
        .map(r => r.id);
      idsToDelete = allowedIds;
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        skipped: stockIds.length,
        errors: ['No stock rows could be deleted (permission denied for all requested rows).'],
      });
    }

    const result = await db.stock.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      skipped: stockIds.length - result.count,
      errors: [],
    });
  } catch (error: any) {
    console.error('Bulk stock delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
