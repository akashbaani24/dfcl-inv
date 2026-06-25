import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/create-entity?token=DFCL_RESCUE_2026
// Body: { name, description?, entityType? }
//
// Admin-only (via rescue token) — used to create entities without needing
// a logged-in admin session. Useful for setup scripts.
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const expected = process.env.MIGRATION_RESCUE_TOKEN || 'DFCL_RESCUE_2026';
    if (token !== expected) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, entityType } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Check if entity with this name already exists
    const existing = await db.entity.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({
        success: true,
        entity: existing,
        message: `Entity "${name}" already exists (id: ${existing.id}). No action taken.`,
      });
    }

    // Create the entity
    const entity = await db.entity.create({
      data: {
        name: name.trim(),
        description: description || null,
        entityType: entityType || 'outlet',
      },
    });

    return NextResponse.json({
      success: true,
      entity,
      message: `Entity "${entity.name}" created with id ${entity.id}.`,
    });
  } catch (error: any) {
    console.error('Create entity error:', error);
    return NextResponse.json(
      { error: 'Failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
