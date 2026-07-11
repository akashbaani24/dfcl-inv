import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/debug-find-items?token=DFCL_RESCUE_2026&search=Ribbon
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }
  const search = request.nextUrl.searchParams.get('search') || '';
  const items = await db.item.findMany({
    where: search ? { itemName: { contains: search } } : {},
    select: { id: true, itemName: true, uom: true },
    take: 50,
  });
  return NextResponse.json({ count: items.length, items });
}
