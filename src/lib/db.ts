import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * Environment-aware database client.
 *
 * Supports THREE deployment targets, auto-detected at runtime:
 *
 * 1. Cloudflare Pages + D1 (Edge runtime)
 *    - D1 binding available via globalThis.__env.DB or process.env.DB
 *    - Used when CF_PAGES=1 and D1 binding is configured
 *
 * 2. Vercel + Turso (Node.js runtime)
 *    - TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars set
 *    - Used for production deployment on Vercel
 *
 * 3. Local development (Node.js runtime)
 *    - SQLite file at DATABASE_URL (default: file:./db/custom.db)
 *    - Used when no other env vars are detected
 *
 * Detection priority: D1 > Turso > Local SQLite
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __env?: { DB?: D1Database } | undefined
}

// ---------- Cloudflare D1 detection ----------
function getCloudflareD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as { __env?: { DB?: D1Database } }).__env
    if (env?.DB) return env.DB
  } catch { /* not on Cloudflare */ }

  if (typeof process !== 'undefined' && process.env?.DB && process.env.CF_PAGES === '1') {
    return process.env.DB as unknown as D1Database
  }

  return null
}

// ---------- Turso detection ----------
function getTursoConfig(): { url: string; authToken: string } | null {
  if (typeof process === 'undefined') return null
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (url && authToken) return { url, authToken }
  return null
}

// ---------- Client factory ----------
function createPrismaClient(): PrismaClient {
  // 1. Cloudflare D1
  const d1 = getCloudflareD1()
  if (d1) {
    // Override DATABASE_URL to satisfy Prisma's schema validation
    if (typeof process !== 'undefined') {
      process.env.DATABASE_URL = 'file:db.sqlite'
    }
    const adapter = new PrismaD1(d1)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 2. Turso (Vercel production)
  const turso = getTursoConfig()
  if (turso) {
    // CRITICAL: Override DATABASE_URL to satisfy Prisma's schema validation.
    // On Vercel, DATABASE_URL might be set to a non-sqlite URL (e.g. from a previous
    // Postgres/Neon setup). Since our schema.prisma says provider = "sqlite",
    // Prisma validates the URL even when using an adapter. Force a valid file: URL.
    if (typeof process !== 'undefined') {
      process.env.DATABASE_URL = 'file:db.sqlite'
    }
    const libsql = createClient({
      url: turso.url,
      authToken: turso.authToken,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 3. Local SQLite (development) — DATABASE_URL stays as user configured
  return new PrismaClient({
    log: ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
