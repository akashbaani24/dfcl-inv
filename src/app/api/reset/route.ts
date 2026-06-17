import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword, ITEM_COLUMNS, MENU_ITEMS } from '@/lib/auth';

// POST reset all system data (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Delete all data in correct order (respecting foreign keys)
    await db.stock.deleteMany();
    await db.userMenuAccess.deleteMany();
    await db.userColumnAccess.deleteMany();
    await db.userEntityAccess.deleteMany();
    await db.session.deleteMany();
    await db.item.deleteMany();
    await db.tailor.deleteMany();
    await db.makingInfo.deleteMany();
    await db.uoM.deleteMany();
    await db.supplier.deleteMany();
    await db.customer.deleteMany();
    await db.entity.deleteMany();
    await db.user.deleteMany();

    // Recreate admin user
    const adminPassword = await hashPassword('admin123');

    await db.user.create({
      data: {
        username: 'admin',
        password: adminPassword,
        displayName: 'Administrator',
        role: 'admin',
        canCreateItem: true,
        canModifyItem: true,
        columnAccess: {
          create: ITEM_COLUMNS.filter(c => !c.alwaysVisible).map(c => ({
            columnName: c.key,
            canView: true,
          })),
        },
        menuAccess: {
          create: MENU_ITEMS.map(m => ({
            menuKey: m.key,
            visible: true,
          })),
        },
      },
    });

    // Seed default UoM
    const defaultUoMs = ['PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'DOZ', 'PACK', 'YARD', 'ROLL', 'PAIR', 'CARTON'];
    await db.uoM.createMany({ data: defaultUoMs.map(name => ({ name })) });

    return NextResponse.json({
      success: true,
      message: 'All data has been reset. Admin credentials: admin/admin123',
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
