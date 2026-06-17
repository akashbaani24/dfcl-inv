/**
 * Runtime configuration for API routes.
 *
 * - On Cloudflare Pages (D1): we MUST use Edge runtime
 * - Locally / on space-z.ai (SQLite via better-sqlite3): we use Node runtime
 *   because Prisma's SQLite driver needs Node APIs and won't work in Edge.
 *
 * Detection: Cloudflare sets process.env.CF_PAGES=1 in their build environment,
 * and at runtime the D1 binding is available on globalThis.
 */

export const IS_CLOUDFLARE =
  typeof process !== 'undefined' &&
  (process.env.CF_PAGES === '1' ||
   process.env.CLOUDFLARE === '1' ||
   // In Cloudflare Workers runtime, process.env may be unavailable
   typeof (globalThis as unknown as { __cf_env?: unknown }).__cf_env !== 'undefined')

// Conditional runtime export: Edge on Cloudflare, Node elsewhere.
// Next.js evaluates this at build time when using `export const runtime`.
// To keep things simple and let the SAME code build for both environments:
//   - When building for Cloudflare via @cloudflare/next-on-pages, set CF_PAGES=1
//   - Otherwise, default to Node runtime (works locally + on space-z.ai)
export const runtime: 'edge' | 'nodejs' = IS_CLOUDFLARE ? 'edge' : 'nodejs'
