import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUserBasic } from '@/lib/auth';
import { getEntitiesCache, setEntitiesCache, invalidateEntitiesCache } from '@/lib/entities-cache';

// GET all entities
export async function GET(request: NextRequest) {
  try {
    // Use lightweight auth check — entity list doesn't need the full permission matrix
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

    // ★ Cache RE-ENABLED with safer behavior (was disabled in v60-fix27):
    //   - TTL reduced from 5 min → 60 sec (less stale data risk)
    //   - Only cache NON-EMPTY results (empty list = either transient failure
    //     or user with no entity access — both cases skip cache so the next
    //     request hits DB fresh)
    //   - The original bug (logo column missing → empty list cached) is now
    //     permanently fixed via migration, so this is safe again.
    const cached = getEntitiesCache();
    if (cached) {
      return NextResponse.json({ entities: cached, source: 'cache' });
    }

    // Optimized: skip _count (was causing slow COUNT subqueries on 22k+ items)
    let entities;
    try {
      entities = await db.entity.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, entityType: true, logo: true, createdAt: true, updatedAt: true },
      });
    } catch (dbErr) {
      console.error('db.entity.findMany error in /api/entities:', dbErr);
      return NextResponse.json({ error: 'DB query failed', detail: String(dbErr) }, { status: 500 });
    }

    // Cache for next call — ONLY if non-empty (so empty results always re-query DB)
    if (entities && entities.length > 0) {
      setEntitiesCache(entities);
    }

    return NextResponse.json({ entities, source: 'db', count: entities?.length ?? 0 });
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

    const { name, description, entityType, logo } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Entity name is required' }, { status: 400 });
    }

    const existing = await db.entity.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Entity name already exists' }, { status: 400 });
    }

    const entity = await db.entity.create({
      data: { name, description: description || null, entityType: entityType || 'outlet', logo: logo || null },
    });

    // Invalidate cache so the new entity shows up immediately
    invalidateEntitiesCache();

    return NextResponse.json({ entity });
  } catch (error) {
    console.error('Create entity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
