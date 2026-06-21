import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl || !tursoToken) return NextResponse.json({ error: 'Turso env vars not set' }, { status: 500 });

    const c = createClient({ url: tursoUrl, authToken: tursoToken });
    const results: string[] = [];

    // Drop old SalesOrder table and recreate
    try { await c.execute('DROP TABLE IF EXISTS "SalesOrder"'); results.push('✓ Dropped old SalesOrder'); } catch (e) { results.push('× Drop: ' + String(e).slice(0, 60)); }

    // Create new SalesOrder
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SalesOrder" (
        "id" TEXT NOT NULL PRIMARY KEY, "salesNo" TEXT NOT NULL,
        "entityId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
        "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "deliveryDate" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'pending', "notes" TEXT,
        "createdBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SalesOrder_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE,
        CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_salesNo_key" ON "SalesOrder"("salesNo")');
      results.push('✓ SalesOrder table');
    } catch (e) { results.push('× SalesOrder: ' + String(e).slice(0, 80)); }

    // SalesOrderItem
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SalesOrderItem" (
        "id" TEXT NOT NULL PRIMARY KEY, "salesOrderId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL, "entityId" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" REAL NOT NULL DEFAULT 0,
        CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE CASCADE,
        CONSTRAINT "SalesOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE,
        CONSTRAINT "SalesOrderItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE INDEX IF NOT EXISTS "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId")');
      results.push('✓ SalesOrderItem table');
    } catch (e) { results.push('× SalesOrderItem: ' + String(e).slice(0, 80)); }

    // SalesMakingEntry
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SalesMakingEntry" (
        "id" TEXT NOT NULL PRIMARY KEY, "salesOrderItemId" TEXT NOT NULL,
        "makingInfoId" TEXT, "name" TEXT NOT NULL,
        "unitPrice" REAL NOT NULL DEFAULT 0, "quantity" INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT "SalesMakingEntry_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE INDEX IF NOT EXISTS "SalesMakingEntry_salesOrderItemId_idx" ON "SalesMakingEntry"("salesOrderItemId")');
      results.push('✓ SalesMakingEntry table');
    } catch (e) { results.push('× SalesMakingEntry: ' + String(e).slice(0, 80)); }

    // SalesPayment
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SalesPayment" (
        "id" TEXT NOT NULL PRIMARY KEY, "salesOrderId" TEXT NOT NULL,
        "receiptNo" TEXT NOT NULL, "amount" REAL NOT NULL,
        "paymentType" TEXT NOT NULL, "paymentMode" TEXT NOT NULL,
        "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "chequeNo" TEXT, "bankName" TEXT, "notes" TEXT,
        "createdBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalesPayment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SalesPayment_receiptNo_key" ON "SalesPayment"("receiptNo")');
      await c.execute('CREATE INDEX IF NOT EXISTS "SalesPayment_salesOrderId_idx" ON "SalesPayment"("salesOrderId")');
      results.push('✓ SalesPayment table');
    } catch (e) { results.push('× SalesPayment: ' + String(e).slice(0, 80)); }

    // BookingReason
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "BookingReason" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "BookingReason_name_key" ON "BookingReason"("name")');
      results.push('✓ BookingReason table');
    } catch (e) { results.push('× BookingReason: ' + String(e).slice(0, 80)); }

    // Ensure Group, SubGroup, Booking, BookingItem
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Group" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Group_name_key" ON "Group"("name")');
      results.push('✓ Group table');
    } catch (e) {}
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SubGroup" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "groupId" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "SubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SubGroup_name_groupId_key" ON "SubGroup"("name", "groupId")');
      results.push('✓ SubGroup table');
    } catch (e) {}
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Booking" ("id" TEXT NOT NULL PRIMARY KEY, "bookingNo" TEXT NOT NULL, "entityId" TEXT NOT NULL, "customerId" TEXT, "bookingDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "tillDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'pending', "reason" TEXT, "notes" TEXT, "createdBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Booking_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE, CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Booking_bookingNo_key" ON "Booking"("bookingNo")');
      results.push('✓ Booking table');
    } catch (e) {}
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "BookingItem" ("id" TEXT NOT NULL PRIMARY KEY, "bookingId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "fromEntityId" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE, CONSTRAINT "BookingItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE, CONSTRAINT "BookingItem_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entity" ("id") ON DELETE CASCADE)`);
      results.push('✓ BookingItem table');
    } catch (e) {}

    // Indexes
    try { await c.execute('CREATE INDEX IF NOT EXISTS idx_stock_entityId ON Stock(entityId)'); } catch (e) {}
    try { await c.execute('CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId)'); } catch (e) {}

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
