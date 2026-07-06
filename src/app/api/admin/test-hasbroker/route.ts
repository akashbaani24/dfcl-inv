import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/test-hasbroker?token=DFCL_RESCUE_2026&salesOrderId=xxx
// Sets hasBroker=true on the given sales order directly via Prisma.
// Used to verify the backend CAN save hasBroker.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const salesOrderId = request.nextUrl.searchParams.get('salesOrderId');
  if (!salesOrderId) {
    return NextResponse.json({ error: 'salesOrderId query param required' }, { status: 400 });
  }

  try {
    const updated = await db.salesOrder.update({
      where: { id: salesOrderId },
      data: { hasBroker: true },
      select: { id: true, salesNo: true, hasBroker: true },
    });
    return NextResponse.json({ success: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
  }
}

// GET — just check a sales order's current hasBroker value
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (token !== 'DFCL_RESCUE_2026') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const salesOrderId = request.nextUrl.searchParams.get('salesOrderId');
  if (!salesOrderId) {
    // List last 5 with hasBroker
    const orders = await db.salesOrder.findMany({
      select: { id: true, salesNo: true, hasBroker: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ orders });
  }

  try {
    const order = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      select: { id: true, salesNo: true, hasBroker: true },
    });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
  }
}
