import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/debug-user-perms?token=DFCL_RESCUE_2026&username=xxx
// Lists ALL users with their masterDataAccess + menuAccess for the 'newItem' key,
// so we can verify whether the permission was actually saved in the DB.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const filterUsername = request.nextUrl.searchParams.get('username') || '';

  try {
    const users = await db.user.findMany({
      where: filterUsername ? { username: { contains: filterUsername } } : {},
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        masterDataAccess: {
          select: {
            masterDataKey: true,
            visible: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canUpload: true,
            canExport: true,
          },
        },
        menuAccess: {
          where: { menuKey: 'newItem' },
          select: { menuKey: true, visible: true, canCreate: true },
        },
      },
      orderBy: { username: 'asc' },
    });

    // Filter to show only newItem-related entries for clarity
    const report = users.map(u => ({
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      newItemMasterDataAccess: u.masterDataAccess.find(m => m.masterDataKey === 'newItem') || null,
      newItemMenuAccess: u.menuAccess[0] || null,
    }));

    return NextResponse.json({
      filterUsername,
      count: report.length,
      users: report,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
