import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// PUT update entity
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserBasic(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, entityType, shortCode, logo } = await request.json();

    const entity = await db.entity.update({
      where: { id },
      data: {
        name,
        description: description || null,
        entityType: entityType || undefined,
        shortCode: shortCode !== undefined ? (shortCode || null) : undefined,
        logo: logo !== undefined ? (logo || null) : undefined,
      },
    });

    return NextResponse.json({ entity });
  } catch (error) {
    console.error('Update entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE entity
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserBasic(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await db.entity.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
