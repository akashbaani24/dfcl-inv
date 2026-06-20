import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic as getCurrentUser, hashPassword, ITEM_COLUMNS, MENU_ITEMS, MASTER_DATA_ITEMS } from '@/lib/auth';

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        canCreateItem: true,
        canModifyItem: true,
        createdAt: true,
        columnAccess: {
          select: { columnName: true, canView: true },
        },
        entityAccess: {
          select: {
            entityId: true,
            entity: { select: { name: true } },
          },
        },
        menuAccess: {
          select: { menuKey: true, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true },
        },
        masterDataAccess: {
          select: { masterDataKey: true, visible: true, canCreate: true, canEdit: true, canDelete: true, canUpload: true, canExport: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map(u => ({
      ...u,
      columnAccess: u.columnAccess,
      entityAccess: u.entityAccess.map(ea => ({
        entityId: ea.entityId,
        entityName: ea.entity.name,
      })),
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { username, password, displayName, role, canCreateItem, canModifyItem, columnAccess, entityIds, menuAccess, masterDataAccess } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: 'Username, password, and display name are required' }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const configurableColumns = ITEM_COLUMNS.filter(c => !c.alwaysVisible);
    const columnAccessData = columnAccess || configurableColumns.map(c => ({
      columnName: c.key,
      canView: true,
    }));

    const entityAccessData = (entityIds || []).map((entityId: string) => ({ entityId }));

    // ★ Build menu access with the 5 per-menu permission flags
    type MenuAccessInput = { menuKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean };
    const menuAccessData: MenuAccessInput[] = (menuAccess || MENU_ITEMS.map(m => ({ menuKey: m.key, visible: true }))).map(
      (ma: MenuAccessInput) => ({
        menuKey: ma.menuKey,
        visible: ma.visible,
        canCreate: !!ma.canCreate,
        canEdit: !!ma.canEdit,
        canDelete: !!ma.canDelete,
        canUpload: !!ma.canUpload,
        canExport: !!ma.canExport,
      })
    );

    // ★ Build master data access with the 5 per-master-data permission flags
    type MasterDataAccessInput = { masterDataKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean };
    const masterDataAccessData: MasterDataAccessInput[] = (masterDataAccess || MASTER_DATA_ITEMS.map(m => ({ masterDataKey: m.key, visible: true }))).map(
      (mda: MasterDataAccessInput) => ({
        masterDataKey: mda.masterDataKey,
        visible: mda.visible,
        canCreate: !!mda.canCreate,
        canEdit: !!mda.canEdit,
        canDelete: !!mda.canDelete,
        canUpload: !!mda.canUpload,
        canExport: !!mda.canExport,
      })
    );

    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        displayName,
        role: role || 'user',
        canCreateItem: canCreateItem || false,
        canModifyItem: canModifyItem || false,
        columnAccess: {
          create: columnAccessData,
        },
        entityAccess: {
          create: entityAccessData,
        },
        menuAccess: {
          create: menuAccessData,
        },
        masterDataAccess: {
          create: masterDataAccessData,
        },
      },
      include: {
        columnAccess: true,
        entityAccess: { include: { entity: true } },
        menuAccess: true,
        masterDataAccess: true,
      },
    });

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
        menuAccess: user.menuAccess.map(ma => ({ menuKey: ma.menuKey, visible: ma.visible, canCreate: ma.canCreate, canEdit: ma.canEdit, canDelete: ma.canDelete, canUpload: ma.canUpload, canExport: ma.canExport })),
        masterDataAccess: user.masterDataAccess.map(mda => ({ masterDataKey: mda.masterDataKey, visible: mda.visible, canCreate: mda.canCreate, canEdit: mda.canEdit, canDelete: mda.canDelete, canUpload: mda.canUpload, canExport: mda.canExport })),
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
