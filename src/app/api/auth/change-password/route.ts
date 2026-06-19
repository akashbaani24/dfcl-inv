import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword, verifyPassword, clearUserCache } from '@/lib/auth';

// POST /api/auth/change-password
// Body: { currentPassword?, newPassword, userId? }
//
// Two modes:
//   1. Self-change: user changes their own password (must provide currentPassword)
//      Body: { currentPassword: '...', newPassword: '...' }
//   2. Admin override: admin changes anyone's password (no currentPassword needed)
//      Body: { userId: 'xxx', newPassword: '...' }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, userId } = body;

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
    }

    // Determine target user
    const targetUserId = userId || currentUser.id;
    const isAdminOverride = userId && userId !== currentUser.id;

    // If admin override, check permission
    if (isAdminOverride && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can change other users\' passwords' }, { status: 403 });
    }

    const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For self-change, verify current password
    if (!isAdminOverride) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }
      const isValid = await verifyPassword(currentPassword, targetUser.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    // Hash and update
    const hashedPassword = await hashPassword(newPassword);
    await db.user.update({
      where: { id: targetUserId },
      data: { password: hashedPassword },
    });

    // Clear cache so the new password takes effect immediately
    // (We don't have the token here, but the cache will expire in 5 min anyway)
    // For immediate effect, the user should re-login.

    return NextResponse.json({
      success: true,
      message: isAdminOverride
        ? `Password changed for user "${targetUser.username}" by admin.`
        : 'Your password has been changed. Please use the new password next time you log in.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
