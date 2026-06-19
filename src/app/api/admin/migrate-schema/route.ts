import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

// POST /api/admin/migrate-schema?token=RESCUE_TOKEN
//
// ★ Emergency migration endpoint — does NOT require login.
//   Needed because login itself depends on the new schema columns.
//
// Uses libsql client directly (NOT prisma) to run ALTER TABLE statements.
// This avoids the need for the prisma binary which isn't available in Vercel's
// serverless runtime.
//
// Auth: ?token=xxx query param (DFCL_RESCUE_2026 default, or MIGRATION_RESCUE_TOKEN env var)

const HARDCODED_RESCUE_TOKEN = 'DFCL_RESCUE_2026';

// All migrations to apply, in order. Each is idempotent (uses IF NOT EXISTS pattern
// by catching "duplicate column" errors).
const MIGRATIONS: { id: string; sql: string; description: string }[] = [
  // v44: Item barcode + itemCode
  {
    id: '2026_06_18_item_barcode',
    sql: 'ALTER TABLE Item ADD COLUMN barcode TEXT',
    description: 'Add barcode column to Item',
  },
  {
    id: '2026_06_18_item_itemcode',
    sql: 'ALTER TABLE Item ADD COLUMN itemCode TEXT',
    description: 'Add itemCode column to Item',
  },
  // v45: UserMenuAccess permission flags
  {
    id: '2026_06_18_menu_canCreate',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canCreate BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canCreate column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canEdit',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canEdit BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canEdit column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canDelete',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canDelete BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canDelete column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canUpload',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canUpload BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canUpload column to UserMenuAccess',
  },
  {
    id: '2026_06_18_menu_canExport',
    sql: 'ALTER TABLE UserMenuAccess ADD COLUMN canExport BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canExport column to UserMenuAccess',
  },
  // v45: UserMasterDataAccess permission flags
  {
    id: '2026_06_18_master_canCreate',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canCreate BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canCreate column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canEdit',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canEdit BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canEdit column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canDelete',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canDelete BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canDelete column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canUpload',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canUpload BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canUpload column to UserMasterDataAccess',
  },
  {
    id: '2026_06_18_master_canExport',
    sql: 'ALTER TABLE UserMasterDataAccess ADD COLUMN canExport BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canExport column to UserMasterDataAccess',
  },
  // v46: Add purchaseId column to Receive (nullable, links Receive to Purchase)
  {
    id: '2026_06_19_receive_purchaseId',
    sql: 'ALTER TABLE Receive ADD COLUMN purchaseId TEXT',
    description: 'Add purchaseId column to Receive (nullable FK to Purchase)',
  },
  // v46: Create Purchase table
  {
    id: '2026_06_19_create_Purchase',
    sql: `CREATE TABLE IF NOT EXISTS "Purchase" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "purchaseNo" TEXT NOT NULL,
      "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "purchaseType" TEXT NOT NULL DEFAULT 'local',
      "entityId" TEXT NOT NULL,
      "supplierId" TEXT,
      "billNo" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE,
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
    )`,
    description: 'Create Purchase table',
  },
  // v46: Create PurchaseItem table
  {
    id: '2026_06_19_create_PurchaseItem',
    sql: `CREATE TABLE IF NOT EXISTS "PurchaseItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "purchaseId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" REAL NOT NULL,
      "uom" TEXT NOT NULL DEFAULT 'PCS',
      "total" REAL NOT NULL,
      FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE,
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE
    )`,
    description: 'Create PurchaseItem table',
  },
  // v46: Add purchaseId FK back to Purchase (now that Purchase exists)
  {
    id: '2026_06_19_receive_purchase_fk',
    sql: 'CREATE INDEX IF NOT EXISTS `Receive_purchaseId_idx` ON `Receive`(`purchaseId`)',
    description: 'Index on Receive.purchaseId',
  },
  // v46: Indexes for Purchase
  {
    id: '2026_06_19_purchase_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `Purchase_entityId_idx` ON `Purchase`(`entityId`)',
    description: 'Index on Purchase.entityId',
  },
  {
    id: '2026_06_19_purchase_idx_supplier',
    sql: 'CREATE INDEX IF NOT EXISTS `Purchase_supplierId_idx` ON `Purchase`(`supplierId`)',
    description: 'Index on Purchase.supplierId',
  },
  {
    id: '2026_06_19_purchase_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Purchase_status_idx` ON `Purchase`(`status`)',
    description: 'Index on Purchase.status',
  },
  {
    id: '2026_06_19_purchase_idx_type',
    sql: 'CREATE INDEX IF NOT EXISTS `Purchase_purchaseType_idx` ON `Purchase`(`purchaseType`)',
    description: 'Index on Purchase.purchaseType',
  },
  {
    id: '2026_06_19_purchase_unique_no',
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS `Purchase_purchaseNo_key` ON `Purchase`(`purchaseNo`)',
    description: 'Unique index on Purchase.purchaseNo',
  },
  // v46: Indexes for PurchaseItem
  {
    id: '2026_06_19_pitem_idx_purchase',
    sql: 'CREATE INDEX IF NOT EXISTS `PurchaseItem_purchaseId_idx` ON `PurchaseItem`(`purchaseId`)',
    description: 'Index on PurchaseItem.purchaseId',
  },
  {
    id: '2026_06_19_pitem_idx_item',
    sql: 'CREATE INDEX IF NOT EXISTS `PurchaseItem_itemId_idx` ON `PurchaseItem`(`itemId`)',
    description: 'Index on PurchaseItem.itemId',
  },
  // v47: Add salesPersonId column to SalesOrder (nullable FK to Employee)
  {
    id: '2026_06_19_sales_person',
    sql: 'ALTER TABLE SalesOrder ADD COLUMN salesPersonId TEXT',
    description: 'Add salesPersonId column to SalesOrder (nullable FK to Employee)',
  },
  // v47: Create Employee table
  {
    id: '2026_06_19_create_Employee',
    sql: `CREATE TABLE IF NOT EXISTS "Employee" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL DEFAULT '',
      "email" TEXT NOT NULL DEFAULT '',
      "address" TEXT NOT NULL DEFAULT '',
      "designation" TEXT NOT NULL DEFAULT '',
      "roles" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    description: 'Create Employee table',
  },
  // v47: Indexes for Employee
  {
    id: '2026_06_19_emp_idx_roles',
    sql: 'CREATE INDEX IF NOT EXISTS `Employee_roles_idx` ON `Employee`(`roles`)',
    description: 'Index on Employee.roles',
  },
  {
    id: '2026_06_19_emp_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Employee_status_idx` ON `Employee`(`status`)',
    description: 'Index on Employee.status',
  },
  // v47: Index for SalesOrder.salesPersonId
  {
    id: '2026_06_19_so_idx_salesperson',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_salesPersonId_idx` ON `SalesOrder`(`salesPersonId`)',
    description: 'Index on SalesOrder.salesPersonId',
  },
  // v48: Add columns to Incentive for formula-based auto-generation
  {
    id: '2026_06_19_inc_formulaId',
    sql: 'ALTER TABLE Incentive ADD COLUMN formulaId TEXT',
    description: 'Add formulaId column to Incentive',
  },
  {
    id: '2026_06_19_inc_salesOrderItemId',
    sql: 'ALTER TABLE Incentive ADD COLUMN salesOrderItemId TEXT',
    description: 'Add salesOrderItemId column to Incentive',
  },
  {
    id: '2026_06_19_inc_units',
    sql: 'ALTER TABLE Incentive ADD COLUMN units INTEGER NOT NULL DEFAULT 1',
    description: 'Add units column to Incentive',
  },
  {
    id: '2026_06_19_inc_saleUnitPrice',
    sql: 'ALTER TABLE Incentive ADD COLUMN saleUnitPrice REAL',
    description: 'Add saleUnitPrice column to Incentive',
  },
  // v48: Create IncentiveFormula table
  {
    id: '2026_06_19_create_IncentiveFormula',
    sql: `CREATE TABLE IF NOT EXISTS "IncentiveFormula" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "priceFrom" REAL NOT NULL,
      "priceTo" REAL NOT NULL,
      "commissionMap" TEXT NOT NULL DEFAULT '{}',
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    description: 'Create IncentiveFormula table',
  },
  // v48: Create IncentiveFormulaItem link table
  {
    id: '2026_06_19_create_IncentiveFormulaItem',
    sql: `CREATE TABLE IF NOT EXISTS "IncentiveFormulaItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "formulaId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("formulaId") REFERENCES "IncentiveFormula"("id") ON DELETE CASCADE,
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE
    )`,
    description: 'Create IncentiveFormulaItem link table',
  },
  // v48: Indexes for IncentiveFormula
  {
    id: '2026_06_19_formula_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `IncentiveFormula_status_idx` ON `IncentiveFormula`(`status`)',
    description: 'Index on IncentiveFormula.status',
  },
  {
    id: '2026_06_19_formula_idx_formulaId',
    sql: 'CREATE INDEX IF NOT EXISTS `Incentive_formulaId_idx` ON `Incentive`(`formulaId`)',
    description: 'Index on Incentive.formulaId',
  },
  // v48: Indexes + unique constraint for IncentiveFormulaItem
  {
    id: '2026_06_19_fitem_idx_formula',
    sql: 'CREATE INDEX IF NOT EXISTS `IncentiveFormulaItem_formulaId_idx` ON `IncentiveFormulaItem`(`formulaId`)',
    description: 'Index on IncentiveFormulaItem.formulaId',
  },
  {
    id: '2026_06_19_fitem_idx_item',
    sql: 'CREATE INDEX IF NOT EXISTS `IncentiveFormulaItem_itemId_idx` ON `IncentiveFormulaItem`(`itemId`)',
    description: 'Index on IncentiveFormulaItem.itemId',
  },
  {
    id: '2026_06_19_fitem_unique',
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS `IncentiveFormulaItem_formulaId_itemId_key` ON `IncentiveFormulaItem`(`formulaId`, `itemId`)',
    description: 'Unique index on IncentiveFormulaItem(formulaId, itemId)',
  },
  // v49: Customer — global + createdByEntity tracking
  {
    id: '2026_06_19_customer_createdByEntityId',
    sql: 'ALTER TABLE Customer ADD COLUMN createdByEntityId TEXT',
    description: 'Add createdByEntityId column to Customer',
  },
  {
    id: '2026_06_19_customer_createdBy',
    sql: 'ALTER TABLE Customer ADD COLUMN createdBy TEXT',
    description: 'Add createdBy column to Customer',
  },
  {
    id: '2026_06_19_customer_idx_createdByEntity',
    sql: 'CREATE INDEX IF NOT EXISTS `Customer_createdByEntityId_idx` ON `Customer`(`createdByEntityId`)',
    description: 'Index on Customer.createdByEntityId',
  },
  // v49: Tailor — entity assignment
  {
    id: '2026_06_19_tailor_entityIds',
    sql: 'ALTER TABLE Tailor ADD COLUMN entityIds TEXT NOT NULL DEFAULT \'\'',
    description: 'Add entityIds column to Tailor (comma-separated)',
  },
  {
    id: '2026_06_19_tailor_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Tailor_status_idx` ON `Tailor`(`status`)',
    description: 'Index on Tailor.status',
  },
  // v49: PurchaseItem — COGS fields
  {
    id: '2026_06_19_pitem_cogsPerUnit',
    sql: 'ALTER TABLE PurchaseItem ADD COLUMN cogsPerUnit REAL NOT NULL DEFAULT 0',
    description: 'Add cogsPerUnit column to PurchaseItem',
  },
  {
    id: '2026_06_19_pitem_cogsNotes',
    sql: 'ALTER TABLE PurchaseItem ADD COLUMN cogsNotes TEXT',
    description: 'Add cogsNotes column to PurchaseItem',
  },
  {
    id: '2026_06_19_pitem_landedCostPerUnit',
    sql: 'ALTER TABLE PurchaseItem ADD COLUMN landedCostPerUnit REAL NOT NULL DEFAULT 0',
    description: 'Add landedCostPerUnit column to PurchaseItem',
  },
];

export async function POST(request: NextRequest) {
  try {
    // Auth via token
    const token = request.nextUrl.searchParams.get('token');
    const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
    if (token !== expected) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl || !tursoToken) {
      return NextResponse.json({
        error: 'TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set on Vercel.',
        hasTursoUrl: !!tursoUrl,
        hasTursoToken: !!tursoToken,
      }, { status: 500 });
    }

    // Connect to Turso directly via libsql
    const client = createClient({ url: tursoUrl, authToken: tursoToken });

    const results: { id: string; description: string; status: 'applied' | 'already-exists' | 'failed'; error?: string }[] = [];

    for (const migration of MIGRATIONS) {
      try {
        await client.execute(migration.sql);
        results.push({ ...migration, status: 'applied' });
      } catch (err: any) {
        const msg = err.message || String(err);
        // SQLite returns "duplicate column name" if the column already exists
        if (/duplicate column name|already exists/i.test(msg)) {
          results.push({ ...migration, status: 'already-exists' });
        } else {
          results.push({ ...migration, status: 'failed', error: msg.slice(0, 200) });
        }
      }
    }

    // Also try to create the unique index on Item.barcode (best-effort, may already exist)
    try {
      await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS `Item_barcode_key` ON `Item`(`barcode`)');
      results.push({ id: 'index_item_barcode', description: 'Unique index on Item.barcode', status: 'applied' });
    } catch (err: any) {
      results.push({ id: 'index_item_barcode', description: 'Unique index on Item.barcode', status: 'failed', error: (err.message || '').slice(0, 200) });
    }

    // Try to create index on Item.itemCode
    try {
      await client.execute('CREATE INDEX IF NOT EXISTS `Item_itemCode_idx` ON `Item`(`itemCode`)');
      results.push({ id: 'index_item_itemCode', description: 'Index on Item.itemCode', status: 'applied' });
    } catch (err: any) {
      results.push({ id: 'index_item_itemCode', description: 'Index on Item.itemCode', status: 'failed', error: (err.message || '').slice(0, 200) });
    }

    const appliedCount = results.filter(r => r.status === 'applied').length;
    const alreadyCount = results.filter(r => r.status === 'already-exists').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: failedCount === 0,
      summary: {
        applied: appliedCount,
        alreadyExists: alreadyCount,
        failed: failedCount,
        total: results.length,
      },
      results,
      message: failedCount === 0
        ? '✅ Migration complete. Login should work now.'
        : `⚠️  Migration completed with ${failedCount} failures. See results for details.`,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed: ' + (error instanceof Error ? error.message : String(error)),
    }, { status: 500 });
  }
}

// GET — status check (also token-gated)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const expected = process.env.MIGRATION_RESCUE_TOKEN || HARDCODED_RESCUE_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
  }
  return NextResponse.json({
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    migrationCount: MIGRATIONS.length,
    message: `POST to this endpoint (with same token) to run ${MIGRATIONS.length} migrations against Turso.`,
  });
}
