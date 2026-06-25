import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/delete-all
//
// ⚠️ DANGEROUS — deletes ALL stock rows across ALL entities.
//
// Body (optional):
//   { confirm: "DELETE-ALL-STOCK" }   — must match exactly to proceed
//
// Used when the user wants to wipe the slate clean before re-uploading fresh
// stock from a daily count.
//
// Permission: ADMIN ONLY (managers cannot do this — too destructive).
//
// Returns: { success, deleted, remaining }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete all stock. Ask an admin to do this.' },
        { status: 403 }
      );
    }

    // Require explicit confirmation string in the body
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE-ALL-STOCK') {
      return NextResponse.json({
        error: 'Confirmation required. Send { confirm: "DELETE-ALL-STOCK" } in the request body to proceed.',
        hint: 'This is a safety check so this endpoint cannot be triggered accidentally.',
      }, { status: 400 });
    }

    // Count before
    const before = await db.stock.count();

    // Delete all stock rows
    const result = await db.stock.deleteMany({});

    // Count after (should be 0)
    const after = await db.stock.count();

    return NextResponse.json({
      success: true,
      deleted: result.count,
      remaining: after,
      beforeCount: before,
      message: `Deleted ${result.count} stock rows (out of ${before} total). ${after} rows remain. All entities now have zero stock — ready for fresh upload.`,
    });
  } catch (error: any) {
    console.error('Delete all stock error:', error);
    return NextResponse.json(
      { error: 'Delete failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
