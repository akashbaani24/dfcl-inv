import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/chat?entityId=xxx&partnerEntityId=yyy
// Returns messages between entityId and partnerEntityId (both directions)
// If no partnerEntityId, returns latest message per partner for the entity
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId') || '';
    const partnerEntityId = searchParams.get('partnerEntityId') || '';

    if (!entityId) return NextResponse.json({ messages: [] });

    if (partnerEntityId) {
      // Get conversation between two entities
      const messages = await db.chatMessage.findMany({
        where: {
          OR: [
            { fromEntityId: entityId, toEntityId: partnerEntityId },
            { fromEntityId: partnerEntityId, toEntityId: entityId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: {
          fromEntity: { select: { name: true } },
          toEntity: { select: { name: true } },
        },
      });

      // Mark received messages as read
      await db.chatMessage.updateMany({
        where: { fromEntityId: partnerEntityId, toEntityId: entityId, read: false },
        data: { read: true },
      });

      // Get sender usernames
      const userIds = [...new Set(messages.map(m => m.createdBy).filter(Boolean))];
      const users = await db.user.findMany({ where: { id: { in: userIds as string[] } }, select: { id: true, displayName: true } });
      const userMap = new Map(users.map(u => [u.id, u.displayName]));

      const messagesWithUser = messages.map(m => ({
        ...m,
        senderName: m.createdBy ? (userMap.get(m.createdBy) || 'Unknown') : 'System',
      }));

      return NextResponse.json({ messages: messagesWithUser });
    } else {
      // Get list of partners with latest message + unread count
      const allMessages = await db.chatMessage.findMany({
        where: {
          OR: [{ fromEntityId: entityId }, { toEntityId: entityId }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          fromEntity: { select: { id: true, name: true } },
          toEntity: { select: { id: true, name: true } },
        },
      });

      // Group by partner entity
      const partnersMap = new Map<string, { partnerId: string; partnerName: string; lastMessage: string; lastMessageTime: string; unread: number }>();
      for (const msg of allMessages) {
        const partnerId = msg.fromEntityId === entityId ? msg.toEntityId : msg.fromEntityId;
        const partnerName = msg.fromEntityId === entityId ? msg.toEntity.name : msg.fromEntity.name;
        const existing = partnersMap.get(partnerId);
        if (!existing) {
          partnersMap.set(partnerId, {
            partnerId,
            partnerName,
            lastMessage: msg.message,
            lastMessageTime: msg.createdAt.toISOString(),
            unread: msg.toEntityId === entityId && !msg.read ? 1 : 0,
          });
        } else {
          if (msg.toEntityId === entityId && !msg.read) existing.unread++;
        }
      }

      return NextResponse.json({ partners: Array.from(partnersMap.values()) });
    }
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat — send a message
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { fromEntityId, toEntityId, message } = await request.json();
    if (!fromEntityId || !toEntityId || !message) {
      return NextResponse.json({ error: 'fromEntityId, toEntityId, and message are required' }, { status: 400 });
    }

    const msg = await db.chatMessage.create({
      data: {
        fromEntityId,
        toEntityId,
        message: message.trim(),
        createdBy: currentUser.id,
      },
      include: {
        fromEntity: { select: { name: true } },
        toEntity: { select: { name: true } },
      },
    });

    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
