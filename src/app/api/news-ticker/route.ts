import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET — returns all active news ticker messages
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const messages = await db.newsTicker.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('News ticker GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a news ticker message (admin/manager only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      return NextResponse.json({ error: 'Only admins and managers can post ticker messages' }, { status: 403 });
    }

    const { message } = await request.json();
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const msg = await db.newsTicker.create({
      data: {
        message: message.trim(),
        createdBy: currentUser.id,
      },
    });

    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error('News ticker POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
