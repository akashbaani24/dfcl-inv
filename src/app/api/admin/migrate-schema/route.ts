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
  // v50: Entity type (outlet/factory/warehouse/head_office) — free-text, no migration needed when adding new types
  {
    id: '2026_06_19_entity_type',
    sql: 'ALTER TABLE Entity ADD COLUMN entityType TEXT NOT NULL DEFAULT \'outlet\'',
    description: 'Add entityType column to Entity (outlet/factory/warehouse/head_office)',
  },
  // v50: Item optional descriptive fields
  {
    id: '2026_06_19_item_color',
    sql: 'ALTER TABLE Item ADD COLUMN color TEXT',
    description: 'Add color column to Item',
  },
  {
    id: '2026_06_19_item_pattern',
    sql: 'ALTER TABLE Item ADD COLUMN pattern TEXT',
    description: 'Add pattern column to Item',
  },
  {
    id: '2026_06_19_item_supplierCode',
    sql: 'ALTER TABLE Item ADD COLUMN supplierCode TEXT',
    description: 'Add supplierCode column to Item',
  },
  {
    id: '2026_06_19_item_dimension',
    sql: 'ALTER TABLE Item ADD COLUMN dimension TEXT',
    description: 'Add dimension column to Item',
  },
  {
    id: '2026_06_19_item_description',
    sql: 'ALTER TABLE Item ADD COLUMN description TEXT',
    description: 'Add description column to Item',
  },
  // v50: IncentiveFormulaRange — new table for multiple ranges per formula
  {
    id: '2026_06_19_create_IncentiveFormulaRange',
    sql: `CREATE TABLE IF NOT EXISTS "IncentiveFormulaRange" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "formulaId" TEXT NOT NULL,
      "priceFrom" REAL NOT NULL,
      "priceTo" REAL NOT NULL,
      "outletCommission" REAL NOT NULL DEFAULT 0,
      "headOfficeCommission" REAL NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("formulaId") REFERENCES "IncentiveFormula"("id") ON DELETE CASCADE
    )`,
    description: 'Create IncentiveFormulaRange table (multiple ranges per formula)',
  },
  {
    id: '2026_06_19_ifr_idx_formula',
    sql: 'CREATE INDEX IF NOT EXISTS `IncentiveFormulaRange_formulaId_idx` ON `IncentiveFormulaRange`(`formulaId`)',
    description: 'Index on IncentiveFormulaRange.formulaId',
  },
  // v51: Add discount column to SalesOrder
  {
    id: '2026_06_19_so_discount',
    sql: 'ALTER TABLE SalesOrder ADD COLUMN discount REAL NOT NULL DEFAULT 0',
    description: 'Add discount column to SalesOrder',
  },
  // v51: Clean up old IncentiveFormula columns (priceFrom, priceTo, commissionMap are no longer in schema)
  // SQLite doesn't support DROP COLUMN, so we just leave them — Prisma will ignore them.
  // But we need to delete old formula records that have no ranges (they'll cause errors when fetched)
  {
    id: '2026_06_19_cleanup_old_formulas',
    sql: "DELETE FROM IncentiveFormula WHERE id NOT IN (SELECT DISTINCT formulaId FROM IncentiveFormulaRange)",
    description: 'Delete old IncentiveFormula records that have no ranges (pre-migration records)',
  },
  // v51: Set defaults on old IncentiveFormula columns so INSERT doesn't fail
  // SQLite doesn't support ALTER COLUMN SET DEFAULT, so we use a workaround:
  // Create a new table without the constraints, copy data, drop old, rename.
  // But simpler: just set the values via UPDATE for existing rows, and for new rows,
  // Prisma won't send those columns so SQLite will use the column default.
  // Since we can't change the default in SQLite, we need to recreate the table.
  {
    id: '2026_06_19_recreate_IncentiveFormula',
    sql: `CREATE TABLE IF NOT EXISTS "IncentiveFormula_new" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    description: 'Create new IncentiveFormula table without old columns',
  },
  {
    id: '2026_06_19_copy_IncentiveFormula',
    sql: `INSERT INTO "IncentiveFormula_new" ("id", "name", "description", "status", "notes", "createdBy", "createdAt", "updatedAt")
          SELECT "id", "name", "description", "status", "notes", "createdBy", "createdAt", "updatedAt" FROM "IncentiveFormula"`,
    description: 'Copy data to new IncentiveFormula table',
  },
  {
    id: '2026_06_19_drop_old_IncentiveFormula',
    sql: 'DROP TABLE IF EXISTS "IncentiveFormula"',
    description: 'Drop old IncentiveFormula table',
  },
  {
    id: '2026_06_19_rename_IncentiveFormula',
    sql: 'ALTER TABLE "IncentiveFormula_new" RENAME TO "IncentiveFormula"',
    description: 'Rename new IncentiveFormula table',
  },
  {
    id: '2026_06_19_formula_idx_status_v2',
    sql: 'CREATE INDEX IF NOT EXISTS `IncentiveFormula_status_idx` ON `IncentiveFormula`(`status`)',
    description: 'Recreate index on IncentiveFormula.status',
  },
  // v52: Performance indexes on SalesOrder
  {
    id: '2026_06_19_so_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_entityId_idx` ON `SalesOrder`(`entityId`)',
    description: 'Index on SalesOrder.entityId',
  },
  {
    id: '2026_06_19_so_idx_customer',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_customerId_idx` ON `SalesOrder`(`customerId`)',
    description: 'Index on SalesOrder.customerId',
  },
  {
    id: '2026_06_19_so_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_status_idx` ON `SalesOrder`(`status`)',
    description: 'Index on SalesOrder.status',
  },
  {
    id: '2026_06_19_so_idx_orderDate',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_orderDate_idx` ON `SalesOrder`(`orderDate`)',
    description: 'Index on SalesOrder.orderDate',
  },
  {
    id: '2026_06_19_so_idx_createdAt',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_createdAt_idx` ON `SalesOrder`(`createdAt`)',
    description: 'Index on SalesOrder.createdAt',
  },
  // v53: Supplier Payment table
  {
    id: '2026_06_19_create_SupplierPayment',
    sql: `CREATE TABLE IF NOT EXISTS "SupplierPayment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "supplierId" TEXT NOT NULL,
      "purchaseId" TEXT,
      "entityId" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paymentType" TEXT NOT NULL DEFAULT 'cash',
      "chequeNo" TEXT,
      "bankName" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE,
      FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create SupplierPayment table',
  },
  {
    id: '2026_06_19_sp_idx_supplier',
    sql: 'CREATE INDEX IF NOT EXISTS `SupplierPayment_supplierId_idx` ON `SupplierPayment`(`supplierId`)',
    description: 'Index on SupplierPayment.supplierId',
  },
  {
    id: '2026_06_19_sp_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `SupplierPayment_entityId_idx` ON `SupplierPayment`(`entityId`)',
    description: 'Index on SupplierPayment.entityId',
  },
  {
    id: '2026_06_19_sp_idx_purchase',
    sql: 'CREATE INDEX IF NOT EXISTS `SupplierPayment_purchaseId_idx` ON `SupplierPayment`(`purchaseId`)',
    description: 'Index on SupplierPayment.purchaseId',
  },
  // v53: Delivery management fields on SalesOrder
  {
    id: '2026_06_19_so_deliveryPerson',
    sql: 'ALTER TABLE SalesOrder ADD COLUMN deliveryPerson TEXT',
    description: 'Add deliveryPerson column to SalesOrder',
  },
  {
    id: '2026_06_19_so_deliveryStatus',
    sql: "ALTER TABLE SalesOrder ADD COLUMN deliveryStatus TEXT NOT NULL DEFAULT 'pending'",
    description: 'Add deliveryStatus column to SalesOrder',
  },
  {
    id: '2026_06_19_so_deliveryNotes',
    sql: 'ALTER TABLE SalesOrder ADD COLUMN deliveryNotes TEXT',
    description: 'Add deliveryNotes column to SalesOrder',
  },
  // v53: Index on deliveryStatus
  {
    id: '2026_06_19_so_idx_deliveryStatus',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_deliveryStatus_idx` ON `SalesOrder`(`deliveryStatus`)',
    description: 'Index on SalesOrder.deliveryStatus',
  },
  // v55: Chat messages table
  {
    id: '2026_06_19_create_ChatMessage',
    sql: `CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "fromEntityId" TEXT NOT NULL,
      "toEntityId" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "createdBy" TEXT,
      "read" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("fromEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE,
      FOREIGN KEY ("toEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create ChatMessage table for entity-to-entity chat',
  },
  {
    id: '2026_06_19_chat_idx_from',
    sql: 'CREATE INDEX IF NOT EXISTS `ChatMessage_fromEntityId_idx` ON `ChatMessage`(`fromEntityId`)',
    description: 'Index on ChatMessage.fromEntityId',
  },
  {
    id: '2026_06_19_chat_idx_to',
    sql: 'CREATE INDEX IF NOT EXISTS `ChatMessage_toEntityId_idx` ON `ChatMessage`(`toEntityId`)',
    description: 'Index on ChatMessage.toEntityId',
  },
  {
    id: '2026_06_19_chat_idx_created',
    sql: 'CREATE INDEX IF NOT EXISTS `ChatMessage_createdAt_idx` ON `ChatMessage`(`createdAt`)',
    description: 'Index on ChatMessage.createdAt',
  },
  // v55: News Ticker table
  {
    id: '2026_06_19_create_NewsTicker',
    sql: `CREATE TABLE IF NOT EXISTS "NewsTicker" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    description: 'Create NewsTicker table',
  },
  {
    id: '2026_06_19_nt_idx_status',
    sql: 'CREATE INDEX IF NOT EXISTS `NewsTicker_status_idx` ON `NewsTicker`(`status`)',
    description: 'Index on NewsTicker.status',
  },
  // ★ TailorPayment table (v57): tracks payments to tailors for sales orders
  {
    id: '2026_06_19_tailor_payment_table',
    sql: `CREATE TABLE IF NOT EXISTS "TailorPayment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "salesOrderId" TEXT NOT NULL,
      "tailorId" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paymentType" TEXT NOT NULL DEFAULT 'cash',
      "referenceNo" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE,
      FOREIGN KEY ("tailorId") REFERENCES "Tailor"("id") ON DELETE CASCADE,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create TailorPayment table',
  },
  {
    id: '2026_06_19_tp_idx_salesorder',
    sql: 'CREATE INDEX IF NOT EXISTS `TailorPayment_salesOrderId_idx` ON `TailorPayment`(`salesOrderId`)',
    description: 'Index on TailorPayment.salesOrderId',
  },
  {
    id: '2026_06_19_tp_idx_tailor',
    sql: 'CREATE INDEX IF NOT EXISTS `TailorPayment_tailorId_idx` ON `TailorPayment`(`tailorId`)',
    description: 'Index on TailorPayment.tailorId',
  },
  {
    id: '2026_06_19_tp_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `TailorPayment_entityId_idx` ON `TailorPayment`(`entityId`)',
    description: 'Index on TailorPayment.entityId',
  },
  {
    id: '2026_06_19_tp_idx_date',
    sql: 'CREATE INDEX IF NOT EXISTS `TailorPayment_paymentDate_idx` ON `TailorPayment`(`paymentDate`)',
    description: 'Index on TailorPayment.paymentDate',
  },
  // ★ v58: Performance indexes for future data growth
  {
    id: '2026_06_19_item_idx_barcode',
    sql: 'CREATE INDEX IF NOT EXISTS `Item_barcode_idx` ON `Item`(`barcode`)',
    description: 'Index on Item.barcode for barcode-based search/lookup',
  },
  // Composite index on Stock for the by-entity query (most common stock query)
  {
    id: '2026_06_19_stock_idx_entity_item',
    sql: 'CREATE INDEX IF NOT EXISTS `Stock_entityId_itemId_idx` ON `Stock`(`entityId`, `itemId`)',
    description: 'Composite index on Stock(entityId, itemId) for fast stock-by-entity queries',
  },
  // Index on Transfer for the "incoming transfers" query (filter by toEntityId + status)
  {
    id: '2026_06_19_transfer_idx_to_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Transfer_toEntityId_status_idx` ON `Transfer`(`toEntityId`, `status`)',
    description: 'Composite index on Transfer(toEntityId, status) for incoming-transfer queries',
  },
  // Index on Transfer for outgoing queries (fromEntityId + status)
  {
    id: '2026_06_19_transfer_idx_from_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Transfer_fromEntityId_status_idx` ON `Transfer`(`fromEntityId`, `status`)',
    description: 'Composite index on Transfer(fromEntityId, status) for outgoing-transfer queries',
  },
  // Index on SalesOrder for entity + status queries
  {
    id: '2026_06_19_salesorder_idx_entity_status',
    sql: 'CREATE INDEX IF NOT EXISTS `SalesOrder_entityId_status_idx` ON `SalesOrder`(`entityId`, `status`)',
    description: 'Composite index on SalesOrder(entityId, status)',
  },
  // Index on Receive for entity + source queries
  {
    id: '2026_06_19_receive_idx_entity_source',
    sql: 'CREATE INDEX IF NOT EXISTS `Receive_entityId_sourceEntityId_idx` ON `Receive`(`entityId`, `sourceEntityId`)',
    description: 'Composite index on Receive(entityId, sourceEntityId)',
  },
  // Index on ItemAdjustment for entity queries
  {
    id: '2026_06_19_itemadj_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `ItemAdjustment_entityId_idx` ON `ItemAdjustment`(`entityId`)',
    description: 'Index on ItemAdjustment.entityId',
  },
  // Index on Purchase for entity + status queries
  {
    id: '2026_06_19_purchase_idx_entity_status',
    sql: 'CREATE INDEX IF NOT EXISTS `Purchase_entityId_status_idx` ON `Purchase`(`entityId`, `status`)',
    description: 'Composite index on Purchase(entityId, status)',
  },
  // ★ v59: Delivery + DeliveryItem tables (multi-delivery per sales order)
  {
    id: '2026_06_19_delivery_table',
    sql: `CREATE TABLE IF NOT EXISTS "Delivery" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "deliveryNo" TEXT NOT NULL UNIQUE,
      "salesOrderId" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "deliveryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deliveryPerson" TEXT,
      "deliveryNotes" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create Delivery table',
  },
  {
    id: '2026_06_19_delivery_idx_salesorder',
    sql: 'CREATE INDEX IF NOT EXISTS `Delivery_salesOrderId_idx` ON `Delivery`(`salesOrderId`)',
    description: 'Index on Delivery.salesOrderId',
  },
  {
    id: '2026_06_19_delivery_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `Delivery_entityId_idx` ON `Delivery`(`entityId`)',
    description: 'Index on Delivery.entityId',
  },
  {
    id: '2026_06_19_delivery_idx_date',
    sql: 'CREATE INDEX IF NOT EXISTS `Delivery_deliveryDate_idx` ON `Delivery`(`deliveryDate`)',
    description: 'Index on Delivery.deliveryDate',
  },
  {
    id: '2026_06_19_deliveryitem_table',
    sql: `CREATE TABLE IF NOT EXISTS "DeliveryItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "deliveryId" TEXT NOT NULL,
      "salesOrderItemId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "uom" TEXT,
      FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE
    )`,
    description: 'Create DeliveryItem table',
  },
  {
    id: '2026_06_19_deliveryitem_idx_delivery',
    sql: 'CREATE INDEX IF NOT EXISTS `DeliveryItem_deliveryId_idx` ON `DeliveryItem`(`deliveryId`)',
    description: 'Index on DeliveryItem.deliveryId',
  },
  {
    id: '2026_06_19_deliveryitem_idx_soitem',
    sql: 'CREATE INDEX IF NOT EXISTS `DeliveryItem_salesOrderItemId_idx` ON `DeliveryItem`(`salesOrderItemId`)',
    description: 'Index on DeliveryItem.salesOrderItemId',
  },
  {
    id: '2026_06_19_deliveryitem_idx_item',
    sql: 'CREATE INDEX IF NOT EXISTS `DeliveryItem_itemId_idx` ON `DeliveryItem`(`itemId`)',
    description: 'Index on DeliveryItem.itemId',
  },
  // ★ v59: Add canApprove column to UserMenuAccess
  {
    id: '2026_06_19_usermenuaccess_canapprove',
    sql: 'ALTER TABLE "UserMenuAccess" ADD COLUMN "canApprove" BOOLEAN NOT NULL DEFAULT 0',
    description: 'Add canApprove column to UserMenuAccess',
  },
  // ★ v59: Add foreign purchase fields + shippingTo to Purchase
  {
    id: '2026_06_20_purchase_lcno',
    sql: 'ALTER TABLE "Purchase" ADD COLUMN "lcNo" TEXT',
    description: 'Add lcNo column to Purchase (foreign purchases)',
  },
  {
    id: '2026_06_20_purchase_pino',
    sql: 'ALTER TABLE "Purchase" ADD COLUMN "piNo" TEXT',
    description: 'Add piNo column to Purchase (foreign purchases)',
  },
  {
    id: '2026_06_20_purchase_bankname',
    sql: 'ALTER TABLE "Purchase" ADD COLUMN "bankName" TEXT',
    description: 'Add bankName column to Purchase (foreign purchases)',
  },
  {
    id: '2026_06_20_purchase_shippingto',
    sql: 'ALTER TABLE "Purchase" ADD COLUMN "shippingTo" TEXT',
    description: 'Add shippingTo column to Purchase (both local and foreign)',
  },
  // ★ v60: AccountsEntry table — manual income/expense + daily sales
  {
    id: '2026_06_20_accountsentry_table',
    sql: `CREATE TABLE IF NOT EXISTS "AccountsEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityId" TEXT NOT NULL,
      "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "entryType" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "cashAmount" REAL NOT NULL DEFAULT 0,
      "cardAmount" REAL NOT NULL DEFAULT 0,
      "chequeAmount" REAL NOT NULL DEFAULT 0,
      "mobileAmount" REAL NOT NULL DEFAULT 0,
      "amount" REAL NOT NULL DEFAULT 0,
      "paymentType" TEXT,
      "description" TEXT,
      "createdBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create AccountsEntry table',
  },
  {
    id: '2026_06_20_accountsentry_idx_entity',
    sql: 'CREATE INDEX IF NOT EXISTS `AccountsEntry_entityId_idx` ON `AccountsEntry`(`entityId`)',
    description: 'Index on AccountsEntry.entityId',
  },
  {
    id: '2026_06_20_accountsentry_idx_date',
    sql: 'CREATE INDEX IF NOT EXISTS `AccountsEntry_entryDate_idx` ON `AccountsEntry`(`entryDate`)',
    description: 'Index on AccountsEntry.entryDate',
  },
  {
    id: '2026_06_20_accountsentry_idx_type',
    sql: 'CREATE INDEX IF NOT EXISTS `AccountsEntry_entryType_idx` ON `AccountsEntry`(`entryType`)',
    description: 'Index on AccountsEntry.entryType',
  },
  // ★ v60: AccountsCategory master table
  {
    id: '2026_06_20_accountscategory_table',
    sql: `CREATE TABLE IF NOT EXISTS "AccountsCategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "entryType" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      UNIQUE("name", "entryType")
    )`,
    description: 'Create AccountsCategory table',
  },
  {
    id: '2026_06_20_accountscategory_idx_type',
    sql: 'CREATE INDEX IF NOT EXISTS `AccountsCategory_entryType_idx` ON `AccountsCategory`(`entryType`)',
    description: 'Index on AccountsCategory.entryType',
  },
  // ★ Seed default categories
  {
    id: '2026_06_20_accountscategory_seed_income',
    sql: `INSERT OR IGNORE INTO "AccountsCategory" ("id","name","entryType","description","status","createdAt","updatedAt") VALUES
      ('seed_ac_inc_1','Sales','income','Sales income','active',datetime('now'),datetime('now')),
      ('seed_ac_inc_2','Service','income','Service income','active',datetime('now'),datetime('now')),
      ('seed_ac_inc_3','Rent Income','income','Rent received','active',datetime('now'),datetime('now')),
      ('seed_ac_inc_4','Interest','income','Bank interest','active',datetime('now'),datetime('now')),
      ('seed_ac_inc_5','Other Income','income','Miscellaneous income','active',datetime('now'),datetime('now'))`,
    description: 'Seed default income categories',
  },
  {
    id: '2026_06_20_accountscategory_seed_expense',
    sql: `INSERT OR IGNORE INTO "AccountsCategory" ("id","name","entryType","description","status","createdAt","updatedAt") VALUES
      ('seed_ac_exp_1','Rent','expense','Office/shop rent','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_2','Salary','expense','Staff salary','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_3','Utilities','expense','Electricity, water, gas','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_4','Transport','expense','Transportation cost','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_5','Maintenance','expense','Equipment maintenance','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_6','Office Supplies','expense','Stationery, supplies','active',datetime('now'),datetime('now')),
      ('seed_ac_exp_7','Misc Expense','expense','Other expenses','active',datetime('now'),datetime('now'))`,
    description: 'Seed default expense categories',
  },
  // v60: Change SalesOrderItem.quantity from INTEGER to REAL (Float) for decimal quantities (e.g. 7.5 meters)
  // SQLite doesn't support ALTER COLUMN TYPE, so we add a new column, copy data, drop old, rename.
  {
    id: '2026_06_21_soitem_qty_float_1',
    sql: 'ALTER TABLE SalesOrderItem ADD COLUMN quantity_new REAL NOT NULL DEFAULT 1',
    description: 'Add quantity_new REAL column to SalesOrderItem',
  },
  {
    id: '2026_06_21_soitem_qty_float_2',
    sql: 'UPDATE SalesOrderItem SET quantity_new = CAST(quantity AS REAL)',
    description: 'Copy quantity data to quantity_new as REAL',
  },
  {
    id: '2026_06_21_soitem_qty_float_3',
    sql: 'ALTER TABLE SalesOrderItem DROP COLUMN quantity',
    description: 'Drop old INTEGER quantity column',
  },
  {
    id: '2026_06_21_soitem_qty_float_4',
    sql: 'ALTER TABLE SalesOrderItem RENAME COLUMN quantity_new TO quantity',
    description: 'Rename quantity_new to quantity',
  },
  // v60: SalesMakingEntry.quantity from INTEGER to REAL
  {
    id: '2026_06_21_sme_qty_float_1',
    sql: 'ALTER TABLE SalesMakingEntry ADD COLUMN quantity_new REAL NOT NULL DEFAULT 1',
    description: 'Add quantity_new REAL column to SalesMakingEntry',
  },
  {
    id: '2026_06_21_sme_qty_float_2',
    sql: 'UPDATE SalesMakingEntry SET quantity_new = CAST(quantity AS REAL)',
    description: 'Copy quantity data to quantity_new as REAL',
  },
  {
    id: '2026_06_21_sme_qty_float_3',
    sql: 'ALTER TABLE SalesMakingEntry DROP COLUMN quantity',
    description: 'Drop old INTEGER quantity column',
  },
  {
    id: '2026_06_21_sme_qty_float_4',
    sql: 'ALTER TABLE SalesMakingEntry RENAME COLUMN quantity_new TO quantity',
    description: 'Rename quantity_new to quantity',
  },
  // v61: Create ItemBarcode table — one item can have multiple barcodes with per-entity stock
  {
    id: '2026_06_22_item_barcode_table',
    sql: `CREATE TABLE IF NOT EXISTS "ItemBarcode" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "itemId" TEXT NOT NULL,
      "barcode" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "quantity" REAL NOT NULL DEFAULT 0,
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE,
      FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE
    )`,
    description: 'Create ItemBarcode table for multiple barcodes per item',
  },
  {
    id: '2026_06_22_item_barcode_unique',
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS `ItemBarcode_barcode_entityId_key` ON `ItemBarcode`(`barcode`, `entityId`)',
    description: 'Unique index on (barcode, entityId)',
  },
  {
    id: '2026_06_22_item_barcode_idx_item',
    sql: 'CREATE INDEX IF NOT EXISTS `ItemBarcode_itemId_entityId_idx` ON `ItemBarcode`(`itemId`, `entityId`)',
    description: 'Index on (itemId, entityId)',
  },
  {
    id: '2026_06_22_item_barcode_idx_barcode',
    sql: 'CREATE INDEX IF NOT EXISTS `ItemBarcode_barcode_idx` ON `ItemBarcode`(`barcode`)',
    description: 'Index on barcode',
  },
  // v62: Add logo column to Entity for company logo
  {
    id: '2026_06_22_entity_logo',
    sql: 'ALTER TABLE Entity ADD COLUMN logo TEXT',
    description: 'Add logo column to Entity (base64 data URL)',
  },
  // v63: Convert Stock.quantity from INTEGER to REAL (Float) so decimal stock
  //      like 0.50 is preserved exactly. SQLite doesn't support ALTER COLUMN
  //      type directly, so we use the table-recreate pattern:
  //      1. Create new table with REAL type
  //      2. Copy data (existing integer values are converted to floats)
  //      3. Drop old table
  //      4. Rename new table
  //      5. Recreate the unique index + entityId index
  //      All steps are idempotent — running them again is safe.
  {
    id: '2026_06_22_stock_qty_float_create_new',
    sql: `CREATE TABLE IF NOT EXISTS "Stock_new" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "itemId" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "quantity" REAL NOT NULL DEFAULT 0,
      CONSTRAINT "Stock_itemId_fkey_new" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Stock_entityId_fkey_new" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    description: 'Create new Stock table with quantity REAL',
  },
  {
    id: '2026_06_22_stock_qty_float_copy_data',
    sql: `INSERT OR IGNORE INTO "Stock_new" ("id", "itemId", "entityId", "quantity")
          SELECT "id", "itemId", "entityId", CAST("quantity" AS REAL) FROM "Stock"`,
    description: 'Copy existing Stock data to new table (integer → float)',
  },
  {
    id: '2026_06_22_stock_qty_float_drop_old',
    sql: 'DROP TABLE IF EXISTS "Stock"',
    description: 'Drop old Stock table',
  },
  {
    id: '2026_06_22_stock_qty_float_rename',
    sql: 'ALTER TABLE "Stock_new" RENAME TO "Stock"',
    description: 'Rename new Stock table to Stock',
  },
  {
    id: '2026_06_22_stock_qty_float_recreate_unique_idx',
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "Stock_itemId_entityId_key" ON "Stock"("itemId", "entityId")',
    description: 'Recreate unique index on Stock(itemId, entityId)',
  },
  {
    id: '2026_06_22_stock_qty_float_recreate_entity_idx',
    sql: 'CREATE INDEX IF NOT EXISTS "Stock_entityId_idx" ON "Stock"("entityId")',
    description: 'Recreate index on Stock.entityId',
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
