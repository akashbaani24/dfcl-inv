import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT update UoM — cascades the rename to all Items using the old UoM name.
// Uses a transaction so the UoM rename + Item updates happen atomically.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'UoM name is required' }, { status: 400 });
    }

    // Check for duplicate name (excluding the current record)
    const existing = await db.uoM.findUnique({ where: { name } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'UoM name already exists' }, { status: 400 });
    }

    // Get the old name so we know which items to update
    const oldUoM = await db.uoM.findUnique({ where: { id } });
    if (!oldUoM) {
      return NextResponse.json({ error: 'UoM not found' }, { status: 404 });
    }
    const oldName = oldUoM.name;
    const newName = name.trim();

    // Atomic transaction: rename UoM + cascade to all items using oldName
    const result = await db.$transaction(async (tx) => {
      // 1. Update the UoM record itself
      const uom = await tx.uoM.update({
        where: { id },
        data: {
          name: newName,
          description: description || '',
        },
      });

      // 2. Cascade rename to all Items whose uom matches the OLD name
      //    (skip if name didn't change)
      let updatedItemsCount = 0;
      if (oldName !== newName) {
        const updateResult = await tx.item.updateMany({
          where: { uom: oldName },
          data: { uom: newName },
        });
        updatedItemsCount = updateResult.count;
      }

      return { uom, updatedItemsCount };
    });

    return NextResponse.json({
      uom: result.uom,
      cascadedItemsUpdated: result.updatedItemsCount,
      message: result.updatedItemsCount > 0
        ? `UoM renamed from "${oldName}" to "${newName}". ${result.updatedItemsCount} item(s) updated.`
        : `UoM updated.`,
    });
  } catch (error) {
    console.error('Update UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE UoM
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;

    await db.uoM.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete UoM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
