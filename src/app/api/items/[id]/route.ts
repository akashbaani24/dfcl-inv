import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMasterData } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// PUT update item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMasterData(currentUser, 'items', 'edit')) {
      return NextResponse.json({ error: 'You do not have permission to modify items' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { year, lcNo, group, subGroup, itemName, price, uom, barcode, itemCode, color, pattern, supplierCode, dimension, description } = body;

    // ★ Check for duplicate itemName (unique constraint)
    if (itemName) {
      const existing = await db.item.findFirst({
        where: { itemName: { equals: itemName }, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Item "${itemName}" already exists. Duplicate item names are not allowed.` },
          { status: 409 }
        );
      }
    }

    // ★ Check for duplicate barcode (unique constraint)
    if (barcode) {
      const existingBc = await db.item.findFirst({
        where: { barcode: { equals: barcode }, id: { not: id } },
        select: { id: true, itemName: true },
      });
      if (existingBc) {
        return NextResponse.json(
          { error: `Barcode "${barcode}" is already used by item "${existingBc.itemName}".` },
          { status: 409 }
        );
      }
    }

    const item = await db.item.update({
      where: { id },
      data: {
        year: year !== undefined ? (year || 'N/A') : undefined,
        lcNo: lcNo !== undefined ? (lcNo || 'N/A') : undefined,
        group: group !== undefined ? (group || 'N/A') : undefined,
        subGroup: subGroup !== undefined ? (subGroup || 'N/A') : undefined,
        itemName: itemName !== undefined ? itemName : undefined,
        price: price !== undefined ? (parseFloat(price) || 0) : undefined,
        uom: uom !== undefined ? (uom || 'PCS') : undefined,
        barcode: barcode !== undefined ? (barcode || null) : undefined,
        itemCode: itemCode !== undefined ? (itemCode || null) : undefined,
        color: color !== undefined ? (color || null) : undefined,
        pattern: pattern !== undefined ? (pattern || null) : undefined,
        supplierCode: supplierCode !== undefined ? (supplierCode || null) : undefined,
        dimension: dimension !== undefined ? (dimension || null) : undefined,
        description: description !== undefined ? (description || null) : undefined,
        updatedBy: currentUser.id,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Update item error:', error);

    // Handle Prisma unique constraint violations
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        const field = target.join(', ');
        return NextResponse.json(
          { error: `This ${field} is already in use by another item. Please use a different value.` },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

// DELETE item
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!canMasterData(currentUser, 'items', 'delete')) {
      return NextResponse.json({ error: 'You do not have permission to delete items' }, { status: 403 });
    }

    const { id } = await params;
    await db.item.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
