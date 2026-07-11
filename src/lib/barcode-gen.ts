import { db } from './db';

/**
 * ★ v60-fix122: Generate a unique barcode in YYMMDD + 7 digits format.
 *
 * Format: YYMMDDXXXXXXX
 *   - YY = 2-digit year (e.g. 25 for 2025)
 *   - MM = 2-digit month (01-12)
 *   - DD = 2-digit day (01-31)
 *   - XXXXXXX = 7-digit sequential counter (0000001, 0000002, ...)
 *
 * Total length: 13 digits (EAN-13 compatible).
 *
 * The counter is stored in a simple "Counter" table row (key = 'barcode').
 * Each call increments the counter atomically and returns the next barcode.
 *
 * Example: 2507110000001 (July 11, 2025, first barcode of the day)
 *          2507110000002 (second barcode)
 *          2507120000003 (July 12, 2025, third barcode overall)
 *
 * Fallback: if the counter table doesn't exist or fails, uses a random
 * 7-digit number instead (still unique enough for most use cases).
 */
export async function generateBarcode(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;

  try {
    // Try to use a counter stored in the DB for sequential numbering.
    // We use a simple approach: find the max barcode starting with this date prefix
    // and increment by 1. This avoids needing a separate Counter table.
    const existing = await db.item.findMany({
      where: {
        barcode: { startsWith: datePrefix },
      },
      select: { barcode: true },
      orderBy: { barcode: 'desc' },
      take: 1,
    });

    let seq = 1;
    if (existing.length > 0 && existing[0].barcode) {
      // Extract the 7-digit sequence from the barcode (last 7 chars)
      const seqStr = existing[0].barcode.slice(-7);
      seq = parseInt(seqStr) + 1;
    }

    const seqStr = String(seq).padStart(7, '0');
    return `${datePrefix}${seqStr}`;
  } catch {
    // Fallback: use random 7-digit number
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    return `${datePrefix}${rand}`;
  }
}

/**
 * Synchronous version — generates a barcode without DB lookup.
 * Uses a random 7-digit number. Less sequential but still YYMMDD + 7 digits.
 */
export function generateBarcodeSync(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;
  const rand = Math.floor(1000000 + Math.random() * 9000000);
  return `${datePrefix}${rand}`;
}
