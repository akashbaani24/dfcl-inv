import { db } from './db';

/**
 * Atomically decrement stock for an item at a given entity.
 *
 * GUARANTEES (business rules):
 *   1. Stock NEVER goes below 0. If the requested decrement would result in a
 *      negative quantity, this function THROWS a `StockGuardError` with details
 *      about the current stock and the attempted decrement.
 *   2. Uses Prisma's atomic `update` with conditional WHERE (`quantity >= X`)
 *      so concurrent requests cannot race past the guard.
 *   3. If no stock row exists, treats current quantity as 0.
 *
 * Usage:
 *   try {
 *     await decrementStock(tx, itemId, entityId, qty);
 *   } catch (e) {
 *     if (e instanceof StockGuardError) {
 *       return NextResponse.json({ error: e.message }, { status: 400 });
 *     }
 *     throw e;
 *   }
 */

export class StockGuardError extends Error {
  public itemId: string;
  public entityId: string;
  public currentQty: number;
  public attemptedDelta: number;
  constructor(itemId: string, entityId: string, currentQty: number, attemptedDelta: number) {
    const sign = attemptedDelta < 0 ? 'decrement' : 'increment';
    const resultingQty = currentQty + attemptedDelta;
    super(
      `Stock guard refused ${sign} for item ${itemId} at entity ${entityId}: ` +
        `current=${currentQty}, attempted ${sign} of ${Math.abs(attemptedDelta)}, ` +
        `would result in ${resultingQty}. Stock must never be negative.`
    );
    this.name = 'StockGuardError';
    this.itemId = itemId;
    this.entityId = entityId;
    this.currentQty = currentQty;
    this.attemptedDelta = attemptedDelta;
  }
}

/**
 * Get current stock quantity for an item at an entity. Returns 0 if no row exists.
 * Accepts either the global db client or a transaction client (tx).
 */
export async function getStock(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  itemId: string,
  entityId: string
): Promise<number> {
  const row = await tx.stock.findUnique({
    where: { itemId_entityId: { itemId, entityId } },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

/**
 * Apply a stock delta (positive = increase, negative = decrease).
 * THROWS StockGuardError if the result would be negative.
 *
 * Uses atomic conditional update so concurrent requests can't race past the guard.
 */
export async function applyStockDelta(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  itemId: string,
  entityId: string,
  delta: number
): Promise<number> {
  if (delta === 0) return await getStock(tx, itemId, entityId);

  // Try to fetch current
  const current = await getStock(tx, itemId, entityId);
  const newQty = current + delta;

  if (newQty < 0) {
    throw new StockGuardError(itemId, entityId, current, delta);
  }

  // Atomic upsert — first attempt: conditional update if row exists AND current >= |decrement|
  if (delta < 0) {
    // Decrement: only update if current quantity is enough (race-safe)
    const absDelta = Math.abs(delta);
    try {
      const updated = await tx.stock.updateMany({
        where: {
          itemId,
          entityId,
          quantity: { gte: absDelta },
        },
        data: { quantity: { decrement: absDelta } },
      });

      if (updated.count === 0) {
        // Either row doesn't exist OR concurrent decrement happened
        // Re-fetch to give a precise error
        const now = await getStock(tx, itemId, entityId);
        throw new StockGuardError(itemId, entityId, now, delta);
      }
      return now_quantity_after_update(tx, itemId, entityId);
    } catch (e) {
      if (e instanceof StockGuardError) throw e;
      // Fall through to upsert path if the updateMany failed for some other reason
      throw e;
    }
  } else {
    // Increment: simple upsert
    await tx.stock.upsert({
      where: { itemId_entityId: { itemId, entityId } },
      update: { quantity: { increment: delta } },
      create: { itemId, entityId, quantity: delta },
    });
    return await getStock(tx, itemId, entityId);
  }
}

/**
 * Helper to read back the quantity after an update (best-effort).
 */
async function now_quantity_after_update(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  itemId: string,
  entityId: string
): Promise<number> {
  return await getStock(tx, itemId, entityId);
}

/**
 * Convenience: explicitly decrement stock. Throws StockGuardError on overflow.
 */
export async function decrementStock(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  itemId: string,
  entityId: string,
  quantity: number
): Promise<number> {
  return applyStockDelta(tx, itemId, entityId, -Math.abs(quantity));
}

/**
 * Convenience: explicitly increment stock.
 */
export async function incrementStock(
  tx: typeof db | Parameters<Parameters<typeof db.$transaction>[0]>[0],
  itemId: string,
  entityId: string,
  quantity: number
): Promise<number> {
  return applyStockDelta(tx, itemId, entityId, Math.abs(quantity));
}
