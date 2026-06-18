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

  // Check cache first
  const cached = userCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.user;
  }

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
  userCache.set(token, { user: session.user, expires: Date.now() + CACHE_TTL });

  return session.user;
}

// Clear cache when user logs out
export function clearUserCache(token: string) {
  userCache.delete(token);
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

// Menu items that can be controlled per user
export const MENU_ITEMS = [
  { key: 'itemPrice', label: 'Item Price', group: 'Function' },
  { key: 'myEntityStock', label: 'My Entity Stock', group: 'Stock View' },
  { key: 'allEntityStock', label: 'All Entity Stock', group: 'Stock View' },
  { key: 'itemAdjustment', label: 'Item Adjustment', group: 'Function' },
  { key: 'transfer', label: 'Transfer', group: 'Function' },
  { key: 'receive', label: 'Receive', group: 'Function' },
  { key: 'salesOrder', label: 'Sales Order', group: 'Sales' },
  { key: 'salesReturn', label: 'Sales Return', group: 'Sales' },
  { key: 'booking', label: 'Booking', group: 'Function' },
  { key: 'incentive', label: 'Incentive', group: 'Function' },
  { key: 'reports', label: 'Reports', group: 'Function' },
] as const;

export type MenuItemKey = typeof MENU_ITEMS[number]['key'];

// Master Data tab sub-pages that can be controlled per user
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
] as const;

export type MasterDataKey = typeof MASTER_DATA_ITEMS[number]['key'];
