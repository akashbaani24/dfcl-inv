import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// POST /api/bookings/upload
//
// Bulk upload bookings from an Excel/CSV file.
//
// Form data: multipart/form-data with field 'file' = .xlsx / .xls / .csv
//
// ★ Expected Excel columns (header row required, case-insensitive):
//
//   bookingNo        — Optional. If blank, auto-generated as BK-YYYYMMDD-XXXX.
//                      If provided, must be unique. If it matches an existing
//                      booking, that row is SKIPPED with a warning.
//   forEntity        — REQUIRED. Entity name (must match an existing Entity.name).
//                      This is the entity the booking is FOR (e.g. customer's outlet).
//   customerName     — Optional. If provided, we try to match an existing customer
//                      by name (case-insensitive). If not found, a new customer is
//                      created. If blank, booking is created without a customer.
//   customerPhone    — Optional. Used when creating a new customer.
//   customerAddress  — Optional. Used when creating a new customer.
//   bookingDate      — Optional. Format: YYYY-MM-DD. Defaults to today.
//   tillDate         — Optional. Format: YYYY-MM-DD. Leave blank for no expiry.
//   status           — Optional. Default: 'pending'. Valid: pending / confirmed /
//                      processing / delivered / cancelled.
//   reason           — Optional. Free text.
//   notes            — Optional. Free text.
//
//   -- Item columns (one row = one item; multiple rows can share the same
//      bookingNo to mean "multiple items in one booking") --
//
//   itemName         — REQUIRED. Must match an existing Item.itemName exactly.
//   fromEntity       — REQUIRED. Entity name where the item is being booked FROM.
//                      (typically the source warehouse)
//   quantity         — REQUIRED. Number (decimal allowed, e.g. 0.5).
//
// ★ Logic:
//   - Rows are grouped by bookingNo (or by forEntity+customerName+bookingDate when
//     bookingNo is blank). Each group becomes ONE Booking with N BookingItems.
//   - Auto-generated booking numbers are unique.
//   - If any row in a group has an invalid item or fromEntity, the WHOLE group is
//     skipped with a clear error message (atomic per booking).
//   - All other valid groups are still processed.
//
// Response:
//   { success, total, created, skipped, errors: [{ row, message }], bookings: [...] }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Permission: admin/manager or has booking create permission
    const canUpload = currentUser.role === 'admin'
      || currentUser.role === 'manager'
      || !!(currentUser.menuAccess?.find((m: any) => m.menuKey === 'booking' && m.visible && (m.canCreate ?? currentUser.canCreateItem ?? false)));
    if (!canUpload) {
      return NextResponse.json(
        { error: 'You do not have permission to upload bookings. Ask an admin to grant "Create" on the Booking menu.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded. Use form field "file".' }, { status: 400 });
    }

    // Parse the file (xlsx handles .xlsx, .xls, and .csv)
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(buf), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: 'Excel file has no sheets.' }, { status: 400 });
    }
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty (no data rows).' }, { status: 400 });
    }

    // Normalize headers (trim + lowercase for lookup)
    const normalizeKey = (k: string) => k.trim().toLowerCase().replace(/\s+/g, '');
    const getCell = (row: any, ...keys: string[]) => {
      for (const k of keys) {
        const nk = normalizeKey(k);
        for (const rk of Object.keys(row)) {
          if (normalizeKey(rk) === nk) {
            const v = row[rk];
            if (v === null || v === undefined) return '';
            return String(v).trim();
          }
        }
      }
      return '';
    };

    // Pre-load all entities + items + customers for fast lookup
    const allEntities = await db.entity.findMany({ select: { id: true, name: true } });
    const entityByName = new Map(allEntities.map(e => [e.name.toLowerCase().trim(), e]));

    // Items: load all (22k+ but we need exact match)
    const allItems = await db.item.findMany({ select: { id: true, itemName: true } });
    const itemByName = new Map(allItems.map(i => [i.itemName.toLowerCase().trim(), i]));

    const allCustomers = await db.customer.findMany({ select: { id: true, name: true, phone: true, address: true } });
    const customerByName = new Map(allCustomers.map(c => [c.name.toLowerCase().trim(), c]));

    // Pre-load booking-reasons for validation (optional)
    const reasons = await db.bookingReason.findMany({ select: { name: true } });
    const validReasons = new Set(reasons.map(r => r.name.toLowerCase().trim()));

    // Group rows by bookingKey
    // bookingKey = bookingNo if provided, else synthetic from forEntity + customerName + bookingDate + reason
    type GroupedRow = {
      bookingNo: string;
      forEntity: string;
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      bookingDate: string;
      tillDate: string;
      status: string;
      reason: string;
      notes: string;
      itemName: string;
      fromEntity: string;
      quantity: string;
      rowIndex: number;
    };
    const groups = new Map<string, GroupedRow[]>();
    const groupMeta = new Map<string, { bookingNo: string; forEntity: string; customerName: string; customerPhone: string; customerAddress: string; bookingDate: string; tillDate: string; status: string; reason: string; notes: string }>();

    rows.forEach((row, idx) => {
      const bookingNo = getCell(row, 'bookingNo', 'bookingno', 'booking_number', 'booking');
      const forEntity = getCell(row, 'forEntity', 'forentity', 'for_entity', 'entity', 'outlet');
      const customerName = getCell(row, 'customerName', 'customername', 'customer', 'customer_name');
      const customerPhone = getCell(row, 'customerPhone', 'customerphone', 'phone');
      const customerAddress = getCell(row, 'customerAddress', 'customeraddress', 'address');
      const bookingDate = getCell(row, 'bookingDate', 'bookingdate', 'date');
      const tillDate = getCell(row, 'tillDate', 'tilldate', 'till_date', 'expiry');
      const status = getCell(row, 'status');
      const reason = getCell(row, 'reason');
      const notes = getCell(row, 'notes', 'note');
      const itemName = getCell(row, 'itemName', 'itemname', 'item', 'item_name');
      const fromEntity = getCell(row, 'fromEntity', 'fromentity', 'from_entity', 'source', 'warehouse');
      const quantity = getCell(row, 'quantity', 'qty');

      // Validate required: forEntity + itemName + fromEntity + quantity
      if (!forEntity && !itemName && !fromEntity && !quantity) {
        // Likely an empty trailing row — skip silently
        return;
      }

      const key = bookingNo
        ? `explicit:${bookingNo.toLowerCase()}`
        : `synthetic:${forEntity.toLowerCase()}|${customerName.toLowerCase()}|${bookingDate}|${reason.toLowerCase()}`;

      if (!groups.has(key)) {
        groups.set(key, []);
        groupMeta.set(key, {
          bookingNo, forEntity, customerName, customerPhone, customerAddress,
          bookingDate, tillDate, status, reason, notes,
        });
      }
      groups.get(key)!.push({
        bookingNo, forEntity, customerName, customerPhone, customerAddress,
        bookingDate, tillDate, status, reason, notes,
        itemName, fromEntity, quantity,
        rowIndex: idx + 2, // +1 for header, +1 for 1-based
      });
    });

    // Process each group as one Booking
    const errors: { row: number; message: string }[] = [];
    const skipped: { row: number; message: string }[] = [];
    const created: any[] = [];

    for (const [key, groupRows] of groups.entries()) {
      const meta = groupMeta.get(key)!;
      const firstRow = groupRows[0].rowIndex;

      // ---- Validate forEntity ----
      const forEntityRec = entityByName.get(meta.forEntity.toLowerCase().trim());
      if (!forEntityRec) {
        errors.push({ row: firstRow, message: `Booking for "${meta.forEntity}" — entity not found. Check the entity name (must match exactly).` });
        continue;
      }

      // ---- Check existing bookingNo ----
      if (meta.bookingNo) {
        const existing = await db.booking.findUnique({ where: { bookingNo: meta.bookingNo } });
        if (existing) {
          skipped.push({ row: firstRow, message: `Booking ${meta.bookingNo} already exists — skipped.` });
          continue;
        }
      }

      // ---- Resolve or create customer ----
      let customerId: string | null = null;
      if (meta.customerName) {
        const existing = customerByName.get(meta.customerName.toLowerCase().trim());
        if (existing) {
          customerId = existing.id;
        } else {
          // Create new customer
          try {
            const newCust = await db.customer.create({
              data: {
                name: meta.customerName,
                phone: meta.customerPhone || undefined,
                address: meta.customerAddress || undefined,
              } as any,
            });
            customerByName.set(meta.customerName.toLowerCase().trim(), newCust);
            customerId = newCust.id;
          } catch (e) {
            errors.push({ row: firstRow, message: `Booking for "${meta.forEntity}" — failed to create customer "${meta.customerName}": ${String(e)}` });
            continue;
          }
        }
      }

      // ---- Validate all items in this booking ----
      const validatedItems: { itemId: string; fromEntityId: string; quantity: number }[] = [];
      let itemError: string | null = null;

      for (const gr of groupRows) {
        if (!gr.itemName) {
          itemError = `Row ${gr.rowIndex}: itemName is required.`;
          break;
        }
        if (!gr.fromEntity) {
          itemError = `Row ${gr.rowIndex}: fromEntity is required.`;
          break;
        }
        if (!gr.quantity || isNaN(Number(gr.quantity))) {
          itemError = `Row ${gr.rowIndex}: quantity must be a number (got "${gr.quantity}").`;
          break;
        }
        const qty = Number(gr.quantity);
        if (qty <= 0) {
          itemError = `Row ${gr.rowIndex}: quantity must be > 0 (got ${qty}).`;
          break;
        }

        const item = itemByName.get(gr.itemName.toLowerCase().trim());
        if (!item) {
          itemError = `Row ${gr.rowIndex}: item "${gr.itemName}" not found. Check the itemName — it must match exactly an existing item.`;
          break;
        }

        const fromEnt = entityByName.get(gr.fromEntity.toLowerCase().trim());
        if (!fromEnt) {
          itemError = `Row ${gr.rowIndex}: fromEntity "${gr.fromEntity}" not found. Check the entity name.`;
          break;
        }

        validatedItems.push({
          itemId: item.id,
          fromEntityId: fromEnt.id,
          quantity: qty,
        });
      }

      if (itemError) {
        errors.push({ row: firstRow, message: `Booking for "${meta.forEntity}" — ${itemError}` });
        continue;
      }

      // ---- Generate booking number if not provided ----
      const finalBookingNo = meta.bookingNo || (() => {
        const now = new Date();
        const ds = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const rs = Math.floor(1000 + Math.random() * 9000).toString();
        return `BK-${ds}-${rs}`;
      })();

      // ---- Validate status ----
      const validStatuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
      const finalStatus = meta.status && validStatuses.includes(meta.status.toLowerCase().trim())
        ? meta.status.toLowerCase().trim()
        : 'pending';

      // ---- Create the booking ----
      try {
        const booking = await db.booking.create({
          data: {
            bookingNo: finalBookingNo,
            entityId: forEntityRec.id,
            customerId,
            bookingDate: meta.bookingDate ? new Date(meta.bookingDate) : new Date(),
            tillDate: meta.tillDate ? new Date(meta.tillDate) : null,
            status: finalStatus,
            reason: meta.reason || null,
            notes: meta.notes || null,
            createdBy: currentUser.id,
            items: {
              create: validatedItems.map(vi => ({
                itemId: vi.itemId,
                fromEntityId: vi.fromEntityId,
                quantity: vi.quantity,
              })),
            },
          } as any,
          include: {
            entity: { select: { name: true } },
            customer: { select: { name: true } },
            items: {
              include: {
                item: { select: { itemName: true } },
                fromEntity: { select: { name: true } },
              },
            },
          },
        });
        created.push(booking);
      } catch (e: any) {
        errors.push({ row: firstRow, message: `Booking for "${meta.forEntity}" — DB error: ${e?.message || String(e)}` });
      }
    }

    return NextResponse.json({
      success: true,
      total: groups.size,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      errorDetails: errors,
      skippedDetails: skipped,
      bookings: created.map(b => ({
        bookingNo: b.bookingNo,
        entity: b.entity?.name,
        customer: b.customer?.name || null,
        status: b.status,
        itemCount: b.items?.length || 0,
      })),
      message: `Created ${created.length} booking(s). Skipped ${skipped.length}. Errors: ${errors.length}.`,
    });
  } catch (error: any) {
    console.error('Booking upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
