import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// GET /api/bookings/export?from=&to=&entityId=
// Exports bookings as Excel with one row per item (not per booking).
//
// Excel columns (per user's format):
//   Booking No | Items | Qty | Customer | Booking From | Booking Date | Till Date | Reason | Status
//
// Each item in a booking gets its own row (so a booking with 3 items = 3 rows).
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const entityId = sp.get('entityId') || '';

    // Build where clause
    const where: any = {};
    if (entityId) {
      where.entityId = entityId;
    }
    if (from || to) {
      where.bookingDate = {};
      if (from) where.bookingDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.bookingDate.lte = toDate;
      }
    }

    // Fetch bookings with items + entity + customer
    const bookings = await db.booking.findMany({
      where,
      orderBy: { bookingDate: 'desc' },
      include: {
        items: {
          include: {
            item: { select: { itemName: true } },
            fromEntity: { select: { name: true } },
          },
        },
        entity: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    // Format date as DD-MMM-YY (e.g. 17-Jun-26)
    const formatDate = (d: Date | null | undefined): string => {
      if (!d) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    };

    // Build rows — one row per item
    const rows: any[] = [];
    for (const b of bookings) {
      const customerName = b.customer?.name || '';
      const bookingDate = formatDate(b.bookingDate);
      const tillDate = formatDate(b.tillDate);
      const reason = b.reason || '';
      const status = b.status || '';

      if (b.items.length === 0) {
        // Booking with no items — still show one row
        rows.push({
          'Booking No': b.bookingNo,
          'Items': '',
          'Qty': '',
          'Customer': customerName,
          'Booking From': '',
          'Booking Date': bookingDate,
          'Till Date': tillDate,
          'Reason': reason,
          'Status': status,
        });
      } else {
        for (const item of b.items) {
          rows.push({
            'Booking No': b.bookingNo,
            'Items': item.item?.itemName || '',
            'Qty': item.quantity,
            'Customer': customerName,
            'Booking From': item.fromEntity?.name || '',
            'Booking Date': bookingDate,
            'Till Date': tillDate,
            'Reason': reason,
            'Status': status,
          });
        }
      }
    }

    // Create Excel
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 20 }, // Booking No
      { wch: 25 }, // Items
      { wch: 8 },  // Qty
      { wch: 20 }, // Customer
      { wch: 30 }, // Booking From
      { wch: 14 }, // Booking Date
      { wch: 14 }, // Till Date
      { wch: 20 }, // Reason
      { wch: 12 }, // Status
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bookings-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Booking export error:', error);
    return NextResponse.json({ error: 'Export failed: ' + String(error) }, { status: 500 });
  }
}
