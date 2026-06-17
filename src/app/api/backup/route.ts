import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// GET - Download a database backup (admin only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get current data counts
    const counts = {
      items: await db.item.count(),
      entities: await db.entity.count(),
      stocks: await db.stock.count(),
      users: await db.user.count(),
      tailors: await db.tailor.count(),
      makingInfo: await db.makingInfo.count(),
      uom: await db.uoM.count(),
      suppliers: await db.supplier.count(),
      customers: await db.customer.count(),
      adjustments: await db.itemAdjustment.count(),
      transfers: await db.transfer.count(),
      receives: await db.receive.count(),
      salesOrders: await db.salesOrder.count(),
      salesReturns: await db.salesReturn.count(),
      incentives: await db.incentive.count(),
    };

    return NextResponse.json({
      message: 'Current database status',
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Backup status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a backup of the database (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const dbPath = path.join(process.cwd(), 'db', 'custom.db');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
    }

    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(process.cwd(), 'db', 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);

    // Also maintain a "latest" backup
    const latestPath = path.join(backupDir, 'latest.db');
    fs.copyFileSync(dbPath, latestPath);

    // Get counts for confirmation
    const counts = {
      items: await db.item.count(),
      entities: await db.entity.count(),
      stocks: await db.stock.count(),
      users: await db.user.count(),
    };

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully',
      backupFile: `backup-${timestamp}.db`,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Backup create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Restore from the latest backup (admin only)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { backupFile } = await request.json();

    const dbPath = path.join(process.cwd(), 'db', 'custom.db');
    const backupDir = path.join(process.cwd(), 'db', 'backups');

    // Determine which backup to restore
    let sourcePath: string;
    if (backupFile) {
      sourcePath = path.join(backupDir, backupFile);
    } else {
      sourcePath = path.join(backupDir, 'latest.db');
    }

    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json({ error: 'No backup found to restore' }, { status: 404 });
    }

    // Create a safety backup of current state before overwriting
    const safetyPath = path.join(backupDir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, safetyPath);
    }

    // Restore
    fs.copyFileSync(sourcePath, dbPath);

    return NextResponse.json({
      success: true,
      message: 'Database restored from backup',
      restoredFrom: path.basename(sourcePath),
      safetyBackup: path.basename(safetyPath),
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
