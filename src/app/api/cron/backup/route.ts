import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@libsql/client';
import { bdNow } from '@/lib/bd-time';
import { uploadBackupToDrive, listDriveBackups, driveStatus } from '@/lib/google-drive-backup';

// GET /api/cron/backup?token=DFCL_BACKUP_2026
//
// This endpoint is called automatically by Vercel Cron at 12:30 UTC = 6:30 PM BD time.
// It exports all tables as JSON and:
//   1. Stores the backup in the database itself (a 'Backup' table — created via migrate-schema).
//   2. Uploads the same backup JSON to Google Drive (if GOOGLE_DRIVE_FOLDER_ID +
//      service account env vars are configured on Vercel). Old backups (>30 days) are
//      auto-deleted from DB; Drive keeps everything (treated as off-site long-term backup).
//
// The backup can also be triggered manually from Settings → Backup.
//
// To download a backup: GET /api/cron/backup?token=DFCL_BACKUP_2026&action=download&id=xxx
// To list backups:       GET /api/cron/backup?token=DFCL_BACKUP_2026&action=list
// To check Drive status: GET /api/cron/backup?token=DFCL_BACKUP_2026&action=drive-status
// To list Drive backups: GET /api/cron/backup?token=DFCL_BACKUP_2026&action=drive-list
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (token !== 'DFCL_BACKUP_2026') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const action = request.nextUrl.searchParams.get('action') || 'create';

    // Drive status check (no auth needed beyond the token)
    if (action === 'drive-status') {
      const status = await driveStatus();
      return NextResponse.json(status);
    }

    // List recent Drive backups
    if (action === 'drive-list') {
      const result = await listDriveBackups();
      return NextResponse.json(result);
    }

    // List in-DB backups
    if (action === 'list') {
      const tursoUrl = process.env.TURSO_DATABASE_URL;
      const tursoToken = process.env.TURSO_AUTH_TOKEN;
      if (!tursoUrl || !tursoToken) {
        return NextResponse.json({ error: 'Turso not configured' }, { status: 500 });
      }
      const client = createClient({ url: tursoUrl, authToken: tursoToken });
      const result = await client.execute(
        `SELECT id, createdAt, sizeBytes, tableName, recordCount FROM "Backup" ORDER BY "createdAt" DESC LIMIT 50`
      );
      return NextResponse.json({ backups: result.rows });
    }

    // Download a specific backup
    if (action === 'download') {
      const id = request.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      const tursoUrl = process.env.TURSO_DATABASE_URL;
      const tursoToken = process.env.TURSO_AUTH_TOKEN;
      if (!tursoUrl || !tursoToken) {
        return NextResponse.json({ error: 'Turso not configured' }, { status: 500 });
      }
      const client = createClient({ url: tursoUrl, authToken: tursoToken });
      const result = await client.execute({
        sql: `SELECT id, createdAt, data FROM "Backup" WHERE id = ?`,
        args: [id],
      });
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }
      const row = result.rows[0] as any;
      const data = JSON.parse(row.data);
      const filename = `backup-${new Date(row.createdAt).toISOString().slice(0, 10)}.json`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: create a new backup
    const tables = [
      'User', 'Entity', 'Item', 'Stock', 'Group', 'SubGroup',
      'Supplier', 'Customer', 'Employee', 'Tailor', 'MakingInfo', 'UoM',
      'BookingReason', 'NewsTicker', 'AccountsCategory',
      'Purchase', 'PurchaseItem', 'SupplierPayment',
      'SalesOrder', 'SalesOrderItem', 'SalesMakingEntry', 'SalesPayment',
      'SalesReturn', 'Booking', 'BookingItem',
      'Transfer', 'Receive', 'ItemAdjustment',
      'Incentive', 'IncentiveFormula', 'IncentiveFormulaRange', 'IncentiveFormulaItem',
      'TailorPayment', 'Delivery', 'DeliveryItem',
      'AccountsEntry', 'ChatMessage',
    ];

    const backupData: Record<string, any> = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedAtBD: bdNow(),
        version: 'v60',
        tableCount: tables.length,
      },
    };

    let totalRecords = 0;
    let totalSize = 0;

    for (const table of tables) {
      try {
        const rows = await (db as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
        backupData[table] = rows;
        totalRecords += rows.length;
      } catch {
        // Table might not exist in Prisma schema — skip
        backupData[table] = [];
      }
    }

    const jsonStr = JSON.stringify(backupData);
    totalSize = jsonStr.length;

    // Store backup in database using direct libsql (avoids needing a Prisma model)
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (tursoUrl && tursoToken) {
      const client = createClient({ url: tursoUrl, authToken: tursoToken });

      // Ensure Backup table exists
      await client.execute(`CREATE TABLE IF NOT EXISTS "Backup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "sizeBytes" INTEGER NOT NULL DEFAULT 0,
        "tableName" TEXT NOT NULL DEFAULT '',
        "recordCount" INTEGER NOT NULL DEFAULT 0,
        "data" TEXT NOT NULL DEFAULT '{}'
      )`);

      const backupId = `bk_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await client.execute({
        sql: `INSERT INTO "Backup" ("id", "createdAt", "sizeBytes", "tableName", "recordCount", "data") VALUES (?, datetime('now'), ?, ?, ?, ?)`,
        args: [backupId, totalSize, `${tables.length} tables`, totalRecords, jsonStr],
      });

      // Auto-delete backups older than 30 days (DB only — Drive keeps everything)
      await client.execute(`DELETE FROM "Backup" WHERE "createdAt" < datetime('now', '-30 days')`);

      // ★ Upload the same backup JSON to Google Drive (off-site backup).
      //    If Drive env vars aren't set, this no-ops gracefully.
      const driveResult = await uploadBackupToDrive(jsonStr, backupId);

      return NextResponse.json({
        success: true,
        backupId,
        exportedAt: bdNow(),
        tables: tables.length,
        totalRecords,
        sizeBytes: totalSize,
        sizeKB: Math.round(totalSize / 1024),
        drive: driveResult,
        message: driveResult.uploaded
          ? 'Backup created. DB + Google Drive upload OK. DB auto-cleanup removes >30-day entries.'
          : 'Backup created in DB only. Drive upload skipped — see drive.reason or drive.error.',
      });
    }

    // Local dev fallback: no Turso configured — just return the JSON for inspection
    return NextResponse.json({
      success: true,
      backupId: `bk_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      exportedAt: bdNow(),
      tables: tables.length,
      totalRecords,
      sizeBytes: totalSize,
      sizeKB: Math.round(totalSize / 1024),
      drive: { uploaded: false, reason: 'no-db-configured' },
      message: 'Backup generated (no Turso DB configured to store it).',
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Backup failed: ' + String(error) }, { status: 500 });
  }
}
