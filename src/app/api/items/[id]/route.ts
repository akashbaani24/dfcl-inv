import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canMasterData } from '@/lib/auth';

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
    const { year, lcNo, group, subGroup, itemName, price, uom, barcode, itemCode, color, pattern, supplierCode, dimension, description } = await request.json();

    const item = await db.item.update({
      where: { id },
      data: {
        year,
        lcNo,
        group,
        subGroup,
        itemName,
        price: parseFloat(price) || 0,
        uom,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
