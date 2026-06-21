import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';
import { invalidateEntitiesCache } from '@/lib/entities-cache';

// PUT update entity
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUserBasic(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, entityType, logo } = await request.json();

    const entity = await db.entity.update({
      where: { id },
      data: {
        name,
        description: description || null,
        entityType: entityType || undefined,
        logo: logo !== undefined ? (logo || null) : undefined,
      },
    });

    // Invalidate in-memory cache so the updated entity shows up immediately
    invalidateEntitiesCache();

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

    // Invalidate in-memory cache so the deleted entity disappears immediately
    invalidateEntitiesCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
