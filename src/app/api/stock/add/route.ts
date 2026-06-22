import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST /api/stock/add
//
// Manual stock entry — admin or any user with canMenu(user, 'myEntityStock', 'create')
// can add stock by typing barcode + item name + qty.
//
// Body:
//   {
//     barcode:   string  — REQUIRED. Must be unique across all Items.
//                          If it matches an existing Item.barcode, we use that item
//                          (and ignore the itemName field — we trust the existing item).
//                          If it doesn't match, we create a new Item with this barcode.
//     itemName:  string  — REQUIRED. Used only when creating a new Item.
//                          If the barcode matches an existing item, this field is ignored
//                          (the existing item's name is preserved).
//     quantity:  number  — REQUIRED. Must be > 0.
//     entityId:  string  — REQUIRED. The entity (outlet/warehouse) whose stock we're adding to.
//     uom?:      string  — optional, defaults to 'PCS'. Only used when creating a new Item.
//     price?:    number  — optional, defaults to 0. Only used when creating a new Item.
//     mode?:     'add' | 'set'  — optional, defaults to 'add'.
//                          'add' = increment existing stock by qty (typical "adding new stock")
//                          'set' = overwrite the stock row's qty with this exact value
//                                  (useful for corrections after physical count)
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
      mode = 'add',
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
    if (mode !== 'add' && mode !== 'set') {
      return NextResponse.json({ error: "Mode must be 'add' or 'set'" }, { status: 400 });
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

    // ---- Find or create the Item by barcode ----
    // Try to find by Item.barcode (single primary barcode).
    // If not found, create a new Item with sensible defaults for the non-optional columns.
    let item = await db.item.findUnique({ where: { barcode: barcode.trim() } });

    let createdNewItem = false;
    if (!item) {
      // Verify itemName uniqueness too (Item has @@unique([itemName])).
      const existingByName = await db.item.findUnique({ where: { itemName: itemName.trim() } });
      if (existingByName) {
        // An item with this name already exists but with a different barcode.
        // Rather than silently swapping barcodes, return a clear error.
        return NextResponse.json({
          error: `An item named "${itemName.trim()}" already exists with a different barcode. Either scan that item's barcode instead, or use a different item name.`,
          existingItemId: existingByName.id,
          existingBarcode: existingByName.barcode,
        }, { status: 409 });
      }

      // Create the new item with minimal required fields filled in.
      // year/lcNo/group/subGroup are non-optional in the schema — default to empty string.
      // Admin can edit them later via the Item Information form.
      item = await db.item.create({
        data: {
          barcode: barcode.trim(),
          itemName: itemName.trim(),
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
    }

    // ---- Upsert the Stock row ----
    // 'add' mode = increment existing qty (typical "I just received new stock")
    // 'set' mode = overwrite with exact qty (typical "after physical count, set correct qty")
    const stock = await db.stock.upsert({
      where: { itemId_entityId: { itemId: item.id, entityId } },
      update: mode === 'add'
        ? { quantity: { increment: qty } }
        : { quantity: Math.round(qty) },
      create: {
        itemId: item.id,
        entityId,
        quantity: mode === 'add' ? Math.round(qty) : Math.round(qty),
      },
      include: { item: true },
    });

    return NextResponse.json({
      success: true,
      stock,
      item: { id: item.id, itemName: item.itemName, barcode: item.barcode, uom: item.uom },
      createdNewItem,
      mode,
      addedQty: qty,
      newTotal: stock.quantity,
      message: createdNewItem
        ? `Created new item "${item.itemName}" (barcode: ${item.barcode}) and set stock to ${stock.quantity} ${item.uom}.`
        : mode === 'add'
          ? `Added ${qty} to existing item "${item.itemName}". New total: ${stock.quantity} ${item.uom}.`
          : `Set stock for "${item.itemName}" to ${stock.quantity} ${item.uom}.`,
    });
  } catch (error: any) {
    console.error('Add stock error:', error);

    // Prisma unique-constraint violation (P2002) — barcode already in use
    if (error?.code === 'P2002' && error?.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        { error: 'This barcode is already in use by another item. Use a unique barcode.' },
        { status: 409 }
      );
    }
    if (error?.code === 'P2002' && error?.meta?.target?.includes('itemName')) {
      return NextResponse.json(
        { error: 'An item with this name already exists. Use a different name or scan the existing item\'s barcode.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add stock: ' + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
