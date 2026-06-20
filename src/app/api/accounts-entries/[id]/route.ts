import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// DELETE /api/accounts-entries/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const entry = await db.accountsEntry.findUnique({ where: { id }, select: { entityId: true } });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    // Entity access check
    const userEntityIds = (currentUser.role === 'admin' || currentUser.role === 'manager')
      ? null : currentUser.entityAccess.map(ea => ea.entityId);
    if (userEntityIds && !userEntityIds.includes(entry.entityId)) {
      return NextResponse.json({ error: 'You can only delete entries for your own entity' }, { status: 403 });
    }

    await db.accountsEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete accounts entry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
