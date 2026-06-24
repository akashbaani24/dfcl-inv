import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// GET /api/bookings/template
//
// Downloads a sample .xlsx template showing the exact column format expected
// by /api/bookings/upload. Two example rows are pre-filled to demonstrate
// (a) one booking with one item, (b) two rows sharing a bookingNo to mean
// multiple items in one booking.
export async function GET() {
  // Sample rows demonstrating the format
  const sampleRows = [
    {
      bookingNo: '',
      forEntity: 'AS Display Centre',
      customerName: 'John Doe',
      customerPhone: '+8801712345678',
      customerAddress: 'House 12, Road 3, Dhanmondi, Dhaka',
      bookingDate: '2026-06-23',
      tillDate: '2026-07-23',
      status: 'pending',
      reason: 'Customer Order',
      notes: 'Sample booking — single item',
      itemName: 'AN-2005-22X22X4 Cushion',
      fromEntity: 'Bosila Warehouse (Fabric Dept)',
      quantity: 2,
    },
    {
      bookingNo: '',
      forEntity: 'AS Display Centre',
      customerName: 'John Doe',
      customerPhone: '+8801712345678',
      customerAddress: 'House 12, Road 3, Dhanmondi, Dhaka',
      bookingDate: '2026-06-23',
      tillDate: '2026-07-23',
      status: 'pending',
      reason: 'Customer Order',
      notes: 'Sample booking — second item, same booking (rows share bookingNo)',
      itemName: 'AJ-214-276-C Pillow Cover',
      fromEntity: 'Bosila Warehouse (Accessory Dept)',
      quantity: 4,
    },
    {
      bookingNo: '',
      forEntity: 'Chittagong Branch',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      bookingDate: '2026-06-23',
      tillDate: '',
      status: 'pending',
      reason: 'Stock Transfer',
      notes: 'Sample — no customer (walk-in / internal booking)',
      itemName: 'AN-2005-22X22X4 Cushion',
      fromEntity: 'Bosila Warehouse (Fabric Dept)',
      quantity: 10,
    },
  ];

  // Build the worksheet
  const ws = XLSX.utils.json_to_sheet(sampleRows);

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 14 }, // bookingNo
    { wch: 22 }, // forEntity
    { wch: 18 }, // customerName
    { wch: 16 }, // customerPhone
    { wch: 32 }, // customerAddress
    { wch: 12 }, // bookingDate
    { wch: 12 }, // tillDate
    { wch: 10 }, // status
    { wch: 16 }, // reason
    { wch: 38 }, // notes
    { wch: 28 }, // itemName
    { wch: 32 }, // fromEntity
    { wch: 10 }, // quantity
  ];

  // Add a second sheet with column documentation
  const docs = [
    { column: 'bookingNo', required: 'No', description: 'Unique booking number. If blank, auto-generated as BK-YYYYMMDD-XXXX. If provided and already exists, that row is SKIPPED.' },
    { column: 'forEntity', required: 'YES', description: 'Entity name the booking is FOR (e.g. customer-facing outlet). Must match an existing Entity.name exactly.' },
    { column: 'customerName', required: 'No', description: 'Customer name. If matches an existing customer (case-insensitive), linked. If not, a new customer is created. Leave blank for walk-in / internal.' },
    { column: 'customerPhone', required: 'No', description: 'Used when creating a new customer.' },
    { column: 'customerAddress', required: 'No', description: 'Used when creating a new customer.' },
    { column: 'bookingDate', required: 'No', description: 'Format: YYYY-MM-DD. Defaults to today.' },
    { column: 'tillDate', required: 'No', description: 'Format: YYYY-MM-DD. Booking auto-cancels after this date if status is pending. Leave blank for no expiry.' },
    { column: 'status', required: 'No', description: 'Default: pending. Valid: pending / confirmed / processing / delivered / cancelled.' },
    { column: 'reason', required: 'No', description: 'Free text or one of the BookingReason master data entries.' },
    { column: 'notes', required: 'No', description: 'Free text.' },
    { column: 'itemName', required: 'YES', description: 'Must match an existing Item.itemName exactly. Look it up in Item Information page.' },
    { column: 'fromEntity', required: 'YES', description: 'Entity name the item is being booked FROM (typically the source warehouse).' },
    { column: 'quantity', required: 'YES', description: 'Number. Decimal allowed (e.g. 0.5).' },
  ];
  const docsWs = XLSX.utils.json_to_sheet(docs);
  docsWs['!cols'] = [
    { wch: 20 }, // column
    { wch: 10 }, // required
    { wch: 80 }, // description
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  XLSX.utils.book_append_sheet(wb, docsWs, 'Column Docs');

  // Write to a buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="booking-upload-template.xlsx"',
    },
  });
}
