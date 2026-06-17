import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

/**
 * Environment-aware database client.
 *
 * - On Cloudflare Pages/Workers (Edge runtime): uses D1 binding via getRequestContext()
 * - Locally / on space-z.ai platform (Node runtime): uses SQLite via PrismaClient
 *
 * The detection is done by checking for the Cloudflare env binding on globalThis.
 * In Cloudflare Pages with @cloudflare/next-on-pages, the env bindings are attached
 * to globalThis by `getRequestContext()` from `@cloudflare/next-on-pages`.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __cf_env?: { DB: D1Database } | undefined
}

// Cloudflare D1 detection
function getCloudflareD1(): D1Database | null {
  try {
    // @cloudflare/next-on-pages exposes env via getRequestContext()
    // It also patches globalThis with the env in newer versions
    const env = (globalThis as unknown as { __env?: { DB?: D1Database } }).__env
    if (env?.DB) return env.DB

    // Try the Cloudflare Pages env (set by next-on-pages)
    const cfEnv = (globalThis as unknown as { CF_PAGES_ENV_DB?: D1Database }).CF_PAGES_ENV_DB
    if (cfEnv) return cfEnv
  } catch { /* not on Cloudflare */ }

  // Also try process.env.DB (works when wrangler injects env vars)
  if (typeof process !== 'undefined' && process.env?.DB) {
    return process.env.DB as unknown as D1Database
  }

  return null
}

function createPrismaClient(): PrismaClient {
  const d1 = getCloudflareD1()
  if (d1) {
    // Running on Cloudflare with D1 binding
    const adapter = new PrismaD1(d1)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // Local / Node runtime — use SQLite directly
  return new PrismaClient({
    log: ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
