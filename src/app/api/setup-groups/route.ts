import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl || !tursoToken) return NextResponse.json({ error: 'Turso env vars not set' }, { status: 500 });

    const c = createClient({ url: tursoUrl, authToken: tursoToken });
    const results: string[] = [];

    // Drop old Booking table (single-item version) and recreate with new schema
    try { await c.execute('DROP TABLE IF EXISTS "Booking"'); results.push('✓ Dropped old Booking table'); } catch (e) { results.push('× Drop old Booking: ' + String(e).slice(0, 80)); }
    try { await c.execute('DROP TABLE IF EXISTS "BookingItem"'); results.push('✓ Dropped old BookingItem'); } catch (e) { results.push('× Drop old BookingItem: ' + String(e).slice(0, 80)); }

    // Create new Booking table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Booking" (
        "id" TEXT NOT NULL PRIMARY KEY, "bookingNo" TEXT NOT NULL,
        "entityId" TEXT NOT NULL, "customerId" TEXT,
        "bookingDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "tillDate" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'pending', "reason" TEXT, "notes" TEXT,
        "createdBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Booking_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE,
        CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Booking_bookingNo_key" ON "Booking"("bookingNo")');
      await c.execute('CREATE INDEX IF NOT EXISTS "Booking_entityId_idx" ON "Booking"("entityId")');
      await c.execute('CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status")');
      results.push('✓ New Booking table created');
    } catch (e) { results.push('× Booking: ' + String(e).slice(0, 80)); }

    // Create BookingItem table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "BookingItem" (
        "id" TEXT NOT NULL PRIMARY KEY, "bookingId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL, "fromEntityId" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE,
        CONSTRAINT "BookingItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE,
        CONSTRAINT "BookingItem_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entity" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE INDEX IF NOT EXISTS "BookingItem_bookingId_idx" ON "BookingItem"("bookingId")');
      await c.execute('CREATE INDEX IF NOT EXISTS "BookingItem_fromEntityId_idx" ON "BookingItem"("fromEntityId")');
      results.push('✓ BookingItem table created');
    } catch (e) { results.push('× BookingItem: ' + String(e).slice(0, 80)); }

    // Also ensure Group, SubGroup, indexes exist
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Group" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Group_name_key" ON "Group"("name")');
      results.push('✓ Group table');
    } catch (e) { results.push('× Group: ' + String(e).slice(0, 80)); }

    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SubGroup" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "groupId" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "SubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE)`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SubGroup_name_groupId_key" ON "SubGroup"("name", "groupId")');
      results.push('✓ SubGroup table');
    } catch (e) { results.push('× SubGroup: ' + String(e).slice(0, 80)); }

    try { await c.execute('CREATE INDEX IF NOT EXISTS idx_stock_entityId ON Stock(entityId)'); results.push('✓ Stock.entityId index'); } catch (e) {}
    try { await c.execute('CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId)'); results.push('✓ Session.userId index'); } catch (e) {}

    
    // BookingReason table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "BookingReason" (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "BookingReason_name_key" ON "BookingReason"("name")');
      results.push('✓ BookingReason table');
    } catch (e) { results.push('× BookingReason: ' + String(e).slice(0, 80)); }

return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
