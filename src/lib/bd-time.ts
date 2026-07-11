// Bangladeshi date/time formatting helpers.
// All times are displayed in Asia/Dhaka (UTC+6) using 24-hour format.

const BD_TZ = 'Asia/Dhaka';

/**
 * Format a date in Bangladeshi time as "DD Mon YYYY" (e.g. "19 Jun 2026").
 * Uses the Intl API with the en-GB locale for short month names.
 */
export function bdDate(input: Date | string | number | undefined | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    timeZone: BD_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date+time in Bangladeshi time as "DD Mon YYYY, HH:MM" (24-hour).
 * Example: "19 Jun 2026, 14:30"
 */
export function bdDateTime(input: Date | string | number | undefined | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('en-GB', {
    timeZone: BD_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: BD_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Format only the time in Bangladeshi time as "HH:MM" (24-hour).
 */
export function bdTime(input: Date | string | number | undefined | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', {
    timeZone: BD_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Get the current date+time in Bangladeshi time as a formatted string.
 */
export function bdNow(): string {
  return bdDateTime(new Date());
}

/**
 * Format a number as BDT (Bangladeshi Taka) currency string.
 * Example: 50000 → "৳ 50,000.00"
 */
export function fmtBDT(n: number): string {
  return '৳ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n || 0);
}

/**
 * ★ v60-fix117: Format a stock quantity — always show at most 2 decimal places.
 *   Fixes the floating-point precision issue where stock shows as
 *   "583.2400000000008" instead of "583.24".
 *   Uses Math.round to eliminate IEEE 754 float artifacts.
 */
export function fmtQty(n: number): string {
  const rounded = Math.round((n || 0) * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

/**
 * Get today's date in BD time as YYYY-MM-DD (for <input type="date"> defaults).
 */
export function bdTodayISO(): string {
  const now = new Date();
  const bdStr = now.toLocaleDateString('en-CA', { timeZone: BD_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return bdStr;
}
