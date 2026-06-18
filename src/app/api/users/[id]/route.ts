import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword, ITEM_COLUMNS, MENU_ITEMS, MASTER_DATA_ITEMS } from '@/lib/auth';

// PUT update user (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { displayName, role, canCreateItem, canModifyItem, password, entityIds, menuAccess, masterDataAccess, columnAccess } = await request.json();

    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (role !== undefined) updateData.role = role;
    if (canCreateItem !== undefined) updateData.canCreateItem = canCreateItem;
    if (canModifyItem !== undefined) updateData.canModifyItem = canModifyItem;
    if (password) updateData.password = await hashPassword(password);

    // Update entity access if provided
    if (entityIds !== undefined) {
      await db.userEntityAccess.deleteMany({ where: { userId: id } });
      if (Array.isArray(entityIds) && entityIds.length > 0) {
        updateData.entityAccess = {
          create: entityIds.map((entityId: string) => ({ entityId })),
        };
      }
    }

    // Update column access if provided
    if (columnAccess !== undefined) {
      await db.userColumnAccess.deleteMany({ where: { userId: id } });
      const configurableColumns = ITEM_COLUMNS.filter(c => !c.alwaysVisible);
      const columnAccessData = configurableColumns.map(col => {
        const access = (columnAccess as { columnName: string; canView: boolean }[])?.find(
          (ca: { columnName: string; canView: boolean }) => ca.columnName === col.key
        );
        return {
          userId: id,
          columnName: col.key,
          canView: access ? access.canView : true,
        };
      });
      await db.userColumnAccess.createMany({ data: columnAccessData });
    }

    // Update menu access if provided
    if (menuAccess !== undefined) {
      await db.userMenuAccess.deleteMany({ where: { userId: id } });
      type MenuAccessInput = { menuKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean };
      const menuAccessData = (menuAccess as MenuAccessInput[]).map(ma => ({
        userId: id,
        menuKey: ma.menuKey,
        visible: ma.visible,
        canCreate: !!ma.canCreate,
        canEdit: !!ma.canEdit,
        canDelete: !!ma.canDelete,
        canUpload: !!ma.canUpload,
        canExport: !!ma.canExport,
      }));
      if (menuAccessData.length > 0) {
        await db.userMenuAccess.createMany({ data: menuAccessData });
      }
    }

    // Update master data access if provided
    if (masterDataAccess !== undefined) {
      await db.userMasterDataAccess.deleteMany({ where: { userId: id } });
      type MasterDataAccessInput = { masterDataKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean };
      const masterDataAccessData = (masterDataAccess as MasterDataAccessInput[]).map(mda => ({
        userId: id,
        masterDataKey: mda.masterDataKey,
        visible: mda.visible,
        canCreate: !!mda.canCreate,
        canEdit: !!mda.canEdit,
        canDelete: !!mda.canDelete,
        canUpload: !!mda.canUpload,
        canExport: !!mda.canExport,
      }));
      if (masterDataAccessData.length > 0) {
        await db.userMasterDataAccess.createMany({ data: masterDataAccessData });
      }
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
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
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE user (admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    if (id === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
