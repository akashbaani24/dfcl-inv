import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/rename-entity?token=DFCL_RESCUE_2026&from=Production%20Dekhaba&to=For%20Production
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const fromName = request.nextUrl.searchParams.get('from') || 'Production Dekhaba';
  const toName = request.nextUrl.searchParams.get('to') || 'For Production';

  try {
    const entity = await db.entity.findFirst({ where: { name: { contains: fromName } } });
    if (!entity) return NextResponse.json({ error: `Entity "${fromName}" not found` }, { status: 404 });

    const updated = await db.entity.update({ where: { id: entity.id }, data: { name: toName } });
    return NextResponse.json({ success: true, oldName: entity.name, newName: updated.name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
