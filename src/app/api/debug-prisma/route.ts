import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Debug endpoint — tests the actual Prisma client (same path as login route)
export async function GET() {
  const logs: string[] = [];
  const startTime = Date.now();

  try {
    logs.push(`[${Date.now() - startTime}ms] Starting Prisma debug`);

    logs.push(`[${Date.now() - startTime}ms] Calling db.user.findUnique`);
    const user = await db.user.findUnique({
      where: { username: 'admin' },
      include: {
        columnAccess: true,
        menuAccess: true,
      },
    });

    logs.push(`[${Date.now() - startTime}ms] Query completed`);

    if (!user) {
      return NextResponse.json({ success: false, logs, error: 'Admin user not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      logs,
      result: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        columnAccessCount: user.columnAccess.length,
        menuAccessCount: user.menuAccess.length,
      }
    }, { status: 200 });

  } catch (err) {
    logs.push(`[${Date.now() - startTime}ms] ERROR: ${String(err)}`);
    return NextResponse.json({
      success: false,
      logs,
      error: String(err),
      errorName: err instanceof Error ? err.name : 'Unknown',
      errorStack: err instanceof Error ? err.stack?.split('\n').slice(0, 10) : null,
    }, { status: 500 });
  }
}
