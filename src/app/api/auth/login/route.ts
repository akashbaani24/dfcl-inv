import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username },
      include: {
        columnAccess: true,
        entityAccess: { include: { entity: true } },
        menuAccess: true,
        masterDataAccess: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await createSession(user.id);

    const response = NextResponse.json({
      token, // Include token so client can store in localStorage and send via Authorization header
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
        // ★ v60-fix101: include ALL permission flags (canCreate, canEdit, etc.)
        //   Previously only { masterDataKey, visible } was sent — missing all the
        //   action flags. So hasPermission('master', 'newItem', 'create') would
        //   always return false because entry.canCreate was undefined.
        masterDataAccess: user.masterDataAccess.map(mda => ({
          masterDataKey: mda.masterDataKey,
          visible: mda.visible,
          canCreate: (mda as any).canCreate ?? false,
          canEdit: (mda as any).canEdit ?? false,
          canDelete: (mda as any).canDelete ?? false,
          canUpload: (mda as any).canUpload ?? false,
          canExport: (mda as any).canExport ?? false,
          canApprove: (mda as any).canApprove ?? false,
        })),
      },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
