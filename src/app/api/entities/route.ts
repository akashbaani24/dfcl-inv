import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';

// GET all entities
export async function GET(request: NextRequest) {
  try {
    let currentUser;
    try {
      currentUser = await getCurrentUserBasic(request);
    } catch (authErr) {
      console.error('getCurrentUserBasic error in /api/entities:', authErr);
      return NextResponse.json({ error: 'Auth check failed', detail: String(authErr) }, { status: 500 });
    }

    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ★ NO CACHE — always query DB directly. The entities-cache module
    //   caused repeated "No Entity Available" bugs on Vercel serverless
    //   because stale empty results persisted across instance reuse.
    //   Entity list is small (~36 rows) so direct DB query is fast enough.
    let entities;
    try {
      entities = await db.entity.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, entityType: true, shortCode: true, logo: true, createdAt: true, updatedAt: true },
      });
    } catch (dbErr) {
      console.error('db.entity.findMany error (with shortCode):', dbErr);
      // Fallback: try without shortCode (in case migration hasn't applied on this instance)
      try {
        entities = await db.entity.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, description: true, entityType: true, logo: true, createdAt: true, updatedAt: true },
        });
      } catch (dbErr2) {
        console.error('db.entity.findMany error (fallback):', dbErr2);
        return NextResponse.json({ error: 'DB query failed', detail: String(dbErr2) }, { status: 500 });
      }
    }

    // ★ NEVER return empty silently — if DB returned 0, log it so we can debug
    if (!entities || entities.length === 0) {
      console.warn('⚠️ /api/entities returned 0 entities! This should not happen if DB has data.');
    }

    return NextResponse.json({ entities: entities || [], source: 'db', count: entities?.length ?? 0 });
  } catch (error) {
    console.error('Get entities error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}

// POST create new entity (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserBasic(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description, entityType, shortCode, logo } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Entity name is required' }, { status: 400 });
    }

    const existing = await db.entity.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Entity name already exists' }, { status: 400 });
    }

    const entity = await db.entity.create({
      data: { name, description: description || null, entityType: entityType || 'outlet', shortCode: shortCode || null, logo: logo || null },
    });

    return NextResponse.json({ entity });
  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
