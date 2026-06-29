import bcrypt from 'bcryptjs';
import { db } from './db';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

// Get current user from either cookie or Authorization header
// Optimized: uses in-memory cache (5 min TTL) to avoid repeated DB queries
// on every API call within the same session
const userCache = new Map<string, { user: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCurrentUser(request?: NextRequest) {
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get('session_token')?.value;
  }

  if (!token) return null;

  // ★ User cache DISABLED — same reason as basicUserCache above.
  // const cached = userCache.get(token);
  // if (cached && cached.expires > Date.now()) {
  //   return cached.user;
  // }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          columnAccess: true,
          entityAccess: { include: { entity: true } },
          menuAccess: true,
          masterDataAccess: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } });
    }
    userCache.delete(token);
    return null;
  }

  // Cache the user for 5 minutes
  // userCache.set(token, { user: session.user, expires: Date.now() + CACHE_TTL });

  return session.user;
}

// Clear cache when user logs out
export function clearUserCache(token: string) {
  userCache.delete(token);
}

// Lightweight auth check — only validates session exists and returns minimal user info
// (id, username, role, displayName, entityId, entityAccess). Skips the expensive
// columnAccess / menuAccess / masterDataAccess joins.
// Use this for read-only endpoints that just need to know "who is calling" without
// needing the full permission matrix (e.g. /api/entities).
const basicUserCache = new Map<string, { user: unknown; expires: number }>();

export async function getCurrentUserBasic(request?: NextRequest) {
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get('session_token')?.value;
  }

  if (!token) return null;

  // ★ Basic cache DISABLED — was causing stale user data on Vercel serverless
  //   instances after deploys. The cache would hold old user records that
  //   had empty entityAccess, causing "No Entity Available" even after
  //   the user was properly set up.
  // const cached = basicUserCache.get(token);
  // if (cached && cached.expires > Date.now()) {
  //   return cached.user;
  // }

  // Lightweight query — only session + user + entityAccess (for filtering)
  const session = await db.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      id: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          canCreateItem: true,
          canModifyItem: true,
          entityAccess: { select: { entityId: true } },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    basicUserCache.delete(token);
    userCache.delete(token);
    return null;
  }

  // Cache disabled — don't set basicUserCache
  // basicUserCache.set(token, { user: session.user, expires: Date.now() + CACHE_TTL });

  return session.user;
}

export function clearBasicUserCache(token: string) {
  basicUserCache.delete(token);
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}

export const ITEM_COLUMNS = [
  { key: 'serial', label: 'Serial', alwaysVisible: true },
  { key: 'year', label: 'Year' },
  { key: 'lcNo', label: 'LC No' },
  { key: 'group', label: 'Group' },
  { key: 'subGroup', label: 'Sub Group' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'price', label: 'Price' },
  { key: 'uom', label: 'UoM' },
  { key: 'stockQty', label: 'Stock' },
] as const;

export type ItemColumnKey = typeof ITEM_COLUMNS[number]['key'];

// ⚠️ IMPORTANT: Every menu item must also be in ALL_MENU_ITEMS in src/app/page.tsx
// AND in the functionItems array. When adding a new menu, add to ALL 3 places.
export const MENU_ITEMS = [
  { key: 'itemPrice', label: 'Item Price', group: 'Function' },
  { key: 'myEntityStock', label: 'My Entity Stock', group: 'Stock View' },
  { key: 'allEntityStock', label: 'All Entity Stock', group: 'Stock View' },
  { key: 'stockForAll', label: 'Stock for All', group: 'Stock View' },
  { key: 'itemAdjustment', label: 'Item Adjustment', group: 'Function' },
  { key: 'transfer', label: 'Transfer', group: 'Function' },
  { key: 'receive', label: 'Receive', group: 'Function' },
  { key: 'purchase', label: 'Purchase', group: 'Purchase' },
  { key: 'purchaseApproval', label: 'Purchase Approval', group: 'Purchase' },
  { key: 'supplierPayments', label: 'Supplier Payments', group: 'Purchase' },
  { key: 'salesOrder', label: 'Sales Order', group: 'Sales' },
  { key: 'salesReturn', label: 'Sales Return', group: 'Sales' },
  { key: 'tailorPayment', label: 'Tailor Payment', group: 'Sales' },
  { key: 'dailySales', label: 'Daily Sales', group: 'Sales' },
  { key: 'delivery', label: 'Delivery', group: 'Sales' },
  { key: 'booking', label: 'Booking', group: 'Function' },
  { key: 'damage', label: 'Damage/Wastage', group: 'Function' },
  { key: 'incentive', label: 'Incentive', group: 'Function' },
  { key: 'newsTicker', label: 'News Ticker', group: 'Function' },
  { key: 'fabricStudio', label: 'Fabric Studio (3D)', group: 'Studio' },
  { key: 'accounts', label: 'Income/Expense', group: 'Function' },
  { key: 'reports', label: 'Reports (All)', group: 'Function' },
  { key: 'reports_overview', label: 'Report: Overview', group: 'Function' },
  { key: 'reports_cashSales', label: 'Report: Daily Sales Records', group: 'Function' },
  { key: 'reports_accounts', label: 'Report: Income/Expense', group: 'Function' },
  { key: 'reports_stock', label: 'Report: Stock', group: 'Function' },
  { key: 'reports_sales', label: 'Report: Sales', group: 'Function' },
  { key: 'reports_transfer', label: 'Report: Transfer', group: 'Function' },
  { key: 'reports_adjustment', label: 'Report: Adjustment', group: 'Function' },
  { key: 'reports_incentive', label: 'Report: Incentive', group: 'Function' },
  { key: 'brokerCommission', label: 'Broker Commission', group: 'Function' },
] as const;

export type MenuItemKey = typeof MENU_ITEMS[number]['key'];

// ⚠️ IMPORTANT: Every master data item must also be in ALL_MASTER_DATA_ITEMS in src/app/page.tsx
// AND in the masterDataItems array. When adding a new master data page, add to ALL 3 places.
export const MASTER_DATA_ITEMS = [
  { key: 'items', label: 'Item Information', adminOnly: false },
  { key: 'newItem', label: 'New Item', adminOnly: false },
  { key: 'upload', label: 'Upload CSV', adminOnly: false },
  { key: 'entities', label: 'Entity', adminOnly: true },
  { key: 'users', label: 'Users', adminOnly: true },
  { key: 'groups', label: 'Groups', adminOnly: false },
  { key: 'subGroups', label: 'Sub Groups', adminOnly: false },
  { key: 'tailors', label: 'Tailors', adminOnly: false },
  { key: 'makingInfo', label: 'Making Information', adminOnly: false },
  { key: 'uom', label: 'UoM', adminOnly: false },
  { key: 'suppliers', label: 'Suppliers', adminOnly: false },
  { key: 'customers', label: 'Customer Database', adminOnly: false },
  { key: 'employees', label: 'Employees', adminOnly: false },
  { key: 'bookingReasons', label: 'Booking Reasons', adminOnly: false },
] as const;

export type MasterDataKey = typeof MASTER_DATA_ITEMS[number]['key'];

// ─── Permission helpers ────────────────────────────────────────────────
// These wrap the per-menu / per-master-data permission flags.
// Admin/manager always passes every check.
// Falls back to the legacy global flags (canCreateItem / canModifyItem) for back-compat
// when a user record has no per-menu access rows yet.

type AnyUser = {
  role: string;
  canCreateItem?: boolean;
  canModifyItem?: boolean;
  menuAccess?: { menuKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean }[];
  masterDataAccess?: { masterDataKey: string; visible: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canUpload?: boolean; canExport?: boolean }[];
};

function isPrivileged(user: AnyUser): boolean {
  return user.role === 'admin' || user.role === 'manager';
}

export function canMenu(user: AnyUser, menuKey: string, action: 'create' | 'edit' | 'delete' | 'upload' | 'export' | 'approve'): boolean {
  if (isPrivileged(user)) return true;
  const ma = user.menuAccess?.find(m => m.menuKey === menuKey);

  // ★ If NO entry exists for this menu, DENY by default.
  //   Previously fell back to global canCreateItem/canModifyItem flags, which
  //   caused users to get permissions the admin never explicitly granted.
  if (!ma) {
    if (action === 'export') return true;  // export is default-allow
    return false;
  }

  // ★ Entry exists but hidden → no permissions.
  if (!ma!.visible) return false;

  // ★ Check the PER-MENU flag ONLY. Do NOT fall back to global flags.
  //   The `?? user.canCreateItem` fallback was the bug — it let users
  //   inherit permissions from global toggles even when admin didn't tick
  //   the per-menu checkbox.
  switch (action) {
    case 'create': return !!ma!.canCreate;
    case 'edit':   return !!ma!.canEdit;
    case 'delete': return !!ma!.canDelete;
    case 'upload': return !!ma!.canUpload;
    case 'export': return ma!.canExport !== false;  // default true unless explicitly false
    case 'approve': return !!((ma! as any).canApprove);
  }
}

export function canMasterData(user: AnyUser, masterDataKey: string, action: 'create' | 'edit' | 'delete' | 'upload' | 'export'): boolean {
  if (isPrivileged(user)) return true;
  const mda = user.masterDataAccess?.find(m => m.masterDataKey === masterDataKey);

  // ★ If NO entry exists, DENY by default (except export).
  if (!mda) {
    if (action === 'export') return true;
    return false;
  }

  // ★ Entry exists but hidden → no permissions.
  if (!mda!.visible) return false;

  // ★ Check PER-MASTER-DATA flag ONLY. No global flag fallback.
  switch (action) {
    case 'create': return !!mda!.canCreate;
    case 'edit':   return !!mda!.canEdit;
    case 'delete': return !!mda!.canDelete;
    case 'upload': return !!mda!.canUpload;
    case 'export': return mda!.canExport !== false;
  }
}
