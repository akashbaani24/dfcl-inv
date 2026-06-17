import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, ITEM_COLUMNS } from '@/lib/auth';

// GET user column access
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const columnAccess = await db.userColumnAccess.findMany({
      where: { userId: id },
    });

    return NextResponse.json({ columnAccess });
  } catch (error) {
    console.error('Get column access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT update user column access (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { columnAccess } = await request.json();

    // Delete existing column access and recreate
    await db.userColumnAccess.deleteMany({ where: { userId: id } });

    const configurableColumns = ITEM_COLUMNS.filter(c => !c.alwaysVisible);

    await db.userColumnAccess.createMany({
      data: configurableColumns.map(col => {
        const access = columnAccess?.find((ca: { columnName: string; canView: boolean }) => ca.columnName === col.key);
        return {
          userId: id,
          columnName: col.key,
          canView: access ? access.canView : true,
        };
      }),
    });

    const updated = await db.userColumnAccess.findMany({ where: { userId: id } });

    return NextResponse.json({ columnAccess: updated });
  } catch (error) {
    console.error('Update column access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
