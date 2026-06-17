import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET stock detail for a specific item across entities
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const stocks = await db.stock.findMany({
      where: { itemId: id },
      include: { entity: true },
    });

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error('Get stock detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE stock entry
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!currentUser.canModifyItem && currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'You do not have permission to delete stock' }, { status: 403 });
    }

    const { id } = await params;
    await db.stock.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete stock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
