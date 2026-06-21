import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT — update category (admin/manager only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admin/manager can edit categories' }, { status: 403 });
    }

    const { id } = await params;
    const { name, entryType, description, status } = await request.json();

    const category = await db.accountsCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(entryType && { entryType }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Update accounts category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE (admin/manager only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admin/manager can delete categories' }, { status: 403 });
    }

    const { id } = await params;
    await db.accountsCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete accounts category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
