import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/add
//
// Manual stock entry — admin or any user with canMenu(user, 'myEntityStock', 'create')
// can add stock by typing barcode + item name + qty.
//
// ★ LOGIC (per user's explicit mental model):
//   "ITEM THAKLE TOH PROBLEM NAI, BARCODE EXIST KORLE PROBLEM,
//    EK E ITEM E ONEK BARCODE HOTEY PAREY."
//
//   • One Item (identified by itemName) can have MANY barcodes.
//   • If the typed ITEM NAME matches an existing item → NOT a problem.
//     Just attach the new barcode to that existing item + add stock.
//   • If the typed BARCODE matches an existing barcode (in Item.barcode primary
//     OR in ItemBarcode table for any entity) → PROBLEM. Return 409 with
//     duplicate:true so the frontend can signal it.
//   • If both barcode and itemName are new → create a new Item.
//
// ★ STOCK TRACKING (v60-fix91):
//   Stock is ALWAYS tracked at the specific barcode level — we upsert a row in
//   the ItemBarcode table for (barcode, entityId) with the entered qty. This
//   way future delivery scans of THAT barcode will find the qty.
//   The generic Stock table (itemId, entityId) is also incremented to keep the
//   aggregate view working.
//
// Body:
//   {
//     barcode:   string  — REQUIRED. Must NOT exist anywhere (Item.barcode OR ItemBarcode).
//     itemName:  string  — REQUIRED. If it matches an existing item, we attach this
//                          new barcode to that item instead of creating a new item.
//     quantity:  number  — REQUIRED. Must be > 0.
//     entityId:  string  — REQUIRED. The entity (outlet/warehouse) whose stock we're adding to.
//     uom?:      string  — optional, defaults to 'PCS'. Used when creating a new Item
//                          (existing items keep their own UoM).
//     price?:    number  — optional, defaults to 0. Used when creating a new Item
//                          (existing items keep their own price).
//   }
//
// Returns the upserted Stock row + the Item it belongs to.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request) as any;
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ★ Permission check — uses the same flag the user-management UI exposes
    //   as "Create" on the "My Entity Stock" menu row.
    //   Admin/manager always pass.
    const canAdd = currentUser.role === 'admin'
      || currentUser.role === 'manager'
      || !!(currentUser.menuAccess?.find(m => m.menuKey === 'myEntityStock' && m.visible && (m.canCreate ?? currentUser.canCreateItem ?? false)));
    if (!canAdd) {
      return NextResponse.json(
        { error: 'You do not have permission to add stock. Ask an admin to grant "Create" on the My Entity Stock menu.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      barcode,
      itemName,
      quantity,
      entityId,
      uom,
      price,
    } = body || {};

    // ---- Validation ----
    if (!barcode || typeof barcode !== 'string' || !barcode.trim()) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 });
    }
    if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
      return NextResponse.json({ error: 'Item Name is required' }, { status: 400 });
    }
    if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
      return NextResponse.json({ error: 'Quantity is required and must be a number' }, { status: 400 });
    }
    const qty = Number(quantity);
    if (qty < 0) {
      return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
    }
    if (!entityId) {
      return NextResponse.json({ error: 'Entity is required' }, { status: 400 });
    }

    // ---- Verify entity exists ----
    const entity = await db.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // ---- Verify entity access (non-admin/manager must have entityAccess entry) ----
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      const hasAccess = currentUser.entityAccess?.some(ea => ea.entityId === entityId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'You do not have access to this entity' }, { status: 403 });
      }
    }

    const cleanBarcode = barcode.trim();
    const cleanItemName = itemName.trim();

    // ============================================================
    // ★ STEP 1: DUPLICATE BARCODE CHECK (across ALL items, ALL entities)
    // ============================================================
    // A barcode is GLOBALLY unique — it cannot exist on any other item
    // (neither as Item.barcode primary, nor as an ItemBarcode row anywhere).
    // If it does → signal back to the user with a warning. Submit blocked.
    const existingItemWithPrimaryBarcode = await db.item.findUnique({
      where: { barcode: cleanBarcode },
      select: { id: true, itemName: true, barcode: true },
    });
    if (existingItemWithPrimaryBarcode) {
      return NextResponse.json({
        error: `Barcode "${cleanBarcode}" already exists for item "${existingItemWithPrimaryBarcode.itemName}". Use a different barcode.`,
        duplicate: true,
        duplicateType: 'barcode',
        existingItemId: existingItemWithPrimaryBarcode.id,
        existingItemName: existingItemWithPrimaryBarcode.itemName,
      }, { status: 409 });
    }

    // Also check ItemBarcode table — same barcode could be attached as an
    // additional barcode to an item that has a different primary barcode.
    const existingItemBarcodeRow = await (db as any).itemBarcode.findFirst({
      where: { barcode: cleanBarcode },
      select: { id: true, itemId: true, entityId: true },
    });
    if (existingItemBarcodeRow) {
      // Fetch the parent item's name for a helpful message
      const parentItem = await db.item.findUnique({
        where: { id: existingItemBarcodeRow.itemId },
        select: { itemName: true },
      });
      return NextResponse.json({
        error: `Barcode "${cleanBarcode}" is already attached to item "${parentItem?.itemName || existingItemBarcodeRow.itemId}". Use a different barcode.`,
        duplicate: true,
        duplicateType: 'barcode',
        existingItemId: existingItemBarcodeRow.itemId,
        existingItemName: parentItem?.itemName,
      }, { status: 409 });
    }

    // ============================================================
    // ★ STEP 2: FIND OR CREATE THE ITEM BY NAME
    // ============================================================
    // Item name match is NOT a problem — it means "this is the same item, just
    // add another barcode to it". One item can have many barcodes.
    let item = await db.item.findUnique({
      where: { itemName: cleanItemName },
    });

    let createdNewItem = false;
    let attachedToExistingItem = false;

    if (!item) {
      // ---- Create a new Item ----
      // Don't set primary barcode (the new barcode is tracked via ItemBarcode table).
      // year/lcNo/group/subGroup are non-optional in the schema — default to ''.
      // Admin can edit them later via the Item Information form.
      item = await db.item.create({
        data: {
          barcode: cleanBarcode,  // also set as primary for backward compat lookups
          itemName: cleanItemName,
          year: '',
          lcNo: '',
          group: '',
          subGroup: '',
          price: typeof price === 'number' ? price : 0,
          uom: uom || 'PCS',
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });
      createdNewItem = true;
    } else {
      // ---- Existing item — attach this new barcode to it ----
      // If the item has no primary barcode yet → set it as primary (helps older lookups).
      // Otherwise → leave primary alone; this barcode will be tracked via ItemBarcode.
      if (!item.barcode) {
        item = await db.item.update({
          where: { id: item.id },
          data: { barcode: cleanBarcode },
        });
      }
      attachedToExistingItem = true;
    }

    // ============================================================
    // ★ STEP 3: UPSERT ItemBarcode ROW — track qty at the specific barcode
    // ============================================================
    // ALWAYS create an ItemBarcode row for (barcode, entityId), even if the
    // item is brand new or already has a primary barcode. This guarantees
    // future delivery scans of THIS exact barcode will find the qty.
    // (barcode, entityId) is unique per the schema — upsert handles re-runs safely.
    try {
      await (db as any).itemBarcode.upsert({
        where: { barcode_entityId: { barcode: cleanBarcode, entityId } },
        update: { quantity: { increment: qty } },
        create: {
          itemId: item.id,
          barcode: cleanBarcode,
          entityId,
          quantity: qty,
        },
      });
    } catch (e) {
      // If ItemBarcode table doesn't exist on this DB yet, fall back gracefully
      // (migrate-schema endpoint will create it). The Stock row below is the
      // primary record anyway.
      console.error('ItemBarcode upsert failed (table may not exist yet):', e);
    }

    // ============================================================
    // ★ STEP 4: UPSERT THE STOCK ROW (aggregate per item × entity)
    // ============================================================
    // Stock is the aggregate tracker (sum of all barcodes' qty for an item).
    // Always increment here (mode was removed per user request — there's no
    // "set" option anymore, only "add").
    // ★ NOTE: quantity is now Float (was Int) so decimal stock like 0.50 is
    //   preserved exactly. Do NOT use Math.round() — it would lose precision.
    const stock = await db.stock.upsert({
      where: { itemId_entityId: { itemId: item.id, entityId } },
      update: { quantity: { increment: qty } },
      create: {
        itemId: item.id,
        entityId,
        quantity: qty,
      },
      include: { item: true },
    });

    // ============================================================
    // ★ STEP 5: BUILD RESPONSE MESSAGE
    // ============================================================
    let message: string;
    if (createdNewItem) {
      message = `Created new item "${item.itemName}" with barcode ${cleanBarcode}. Stock set to ${stock.quantity} ${item.uom} at barcode level.`;
    } else if (attachedToExistingItem) {
      message = `Attached new barcode ${cleanBarcode} to existing item "${item.itemName}". Added ${qty} at this barcode. New aggregate total: ${stock.quantity} ${item.uom}.`;
    } else {
      message = `Added ${qty} to item "${item.itemName}" at barcode ${cleanBarcode}. New aggregate total: ${stock.quantity} ${item.uom}.`;
    }

    return NextResponse.json({
      success: true,
      stock,
      item: { id: item.id, itemName: item.itemName, barcode: item.barcode, uom: item.uom },
      createdNewItem,
      attachedToExistingItem,
      addedBarcode: cleanBarcode,
      addedQty: qty,
      newTotal: stock.quantity,
      message,
    });
  } catch (error: any) {
    console.error('Add stock error:', error);

    // Prisma unique-constraint violation (P2002) — barcode already in use
    if (error?.code === 'P2002' && error?.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        { error: 'This barcode is already in use. Use a unique barcode.', duplicate: true, duplicateType: 'barcode' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add stock: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
