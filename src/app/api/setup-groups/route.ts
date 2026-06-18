import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// One-time endpoint to create missing tables on Turso (Group, SubGroup, Booking)
export async function GET() {
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
      return NextResponse.json({ error: 'Turso env vars not set' }, { status: 500 });
    }

    const c = createClient({ url: tursoUrl, authToken: tursoToken });
    const results: string[] = [];

    // Group table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Group" (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'active', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Group_name_key" ON "Group"("name")');
      results.push('✓ Group table');
    } catch (e) { results.push('✗ Group: ' + String(e).slice(0, 80)); }

    // SubGroup table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "SubGroup" (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "groupId" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "SubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE
      )`);
      await c.execute('CREATE UNIQUE INDEX IF NOT EXISTS "SubGroup_name_groupId_key" ON "SubGroup"("name", "groupId")');
      results.push('✓ SubGroup table');
    } catch (e) { results.push('✗ SubGroup: ' + String(e).slice(0, 80)); }

    // Booking table
    try {
      await c.execute(`CREATE TABLE IF NOT EXISTS "Booking" (
        "id" TEXT NOT NULL PRIMARY KEY, "entityId" TEXT NOT NULL, "itemId" TEXT,
        "customerId" TEXT, "bookingNo" TEXT NOT NULL DEFAULT '', "quantity" INTEGER NOT NULL DEFAULT 1,
        "amount" REAL NOT NULL DEFAULT 0, "bookingDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deliveryDate" DATETIME, "status" TEXT NOT NULL DEFAULT 'pending', "notes" TEXT,
        "createdBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Booking_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE,
        CONSTRAINT "Booking_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL,
        CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL
      )`);
      await c.execute('CREATE INDEX IF NOT EXISTS "Booking_entityId_idx" ON "Booking"("entityId")');
      await c.execute('CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status")');
      await c.execute('CREATE INDEX IF NOT EXISTS "Booking_bookingDate_idx" ON "Booking"("bookingDate")');
      results.push('✓ Booking table');
    } catch (e) { results.push('✗ Booking: ' + String(e).slice(0, 80)); }

    // Performance indexes
    try {
      await c.execute('CREATE INDEX IF NOT EXISTS idx_stock_entityId ON Stock(entityId)');
      results.push('✓ Stock.entityId index');
    } catch (e) { results.push('✗ Stock index: ' + String(e).slice(0, 80)); }

    try {
      await c.execute('CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId)');
      results.push('✓ Session.userId index');
    } catch (e) { results.push('✗ Session index: ' + String(e).slice(0, 80)); }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
