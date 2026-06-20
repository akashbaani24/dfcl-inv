import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        canCreateItem: user.canCreateItem,
        canModifyItem: user.canModifyItem,
        columnAccess: user.columnAccess.map(ca => ({ columnName: ca.columnName, canView: ca.canView })),
        entityAccess: user.entityAccess.map(ea => ({ entityId: ea.entityId, entityName: ea.entity.name })),
        menuAccess: user.menuAccess.map(ma => ({
          menuKey: ma.menuKey,
          visible: ma.visible,
          canCreate: (ma as any).canCreate ?? false,
          canEdit: (ma as any).canEdit ?? false,
          canDelete: (ma as any).canDelete ?? false,
          canUpload: (ma as any).canUpload ?? false,
          canExport: (ma as any).canExport ?? false,
          canApprove: (ma as any).canApprove ?? false,
        })),
        masterDataAccess: (user.masterDataAccess || []).map(mda => ({
          masterDataKey: mda.masterDataKey,
          visible: mda.visible,
          canCreate: (mda as any).canCreate ?? false,
          canEdit: (mda as any).canEdit ?? false,
          canDelete: (mda as any).canDelete ?? false,
          canUpload: (mda as any).canUpload ?? false,
          canExport: (mda as any).canExport ?? false,
        })),
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300', // ★ Cache for 5 minutes on the client
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
