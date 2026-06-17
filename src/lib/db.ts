import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

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

// ---------- Force PRISMA_DATABASE_URL before Prisma reads it ----------
// Prisma reads the URL at module load time. Set it BEFORE any PrismaClient
// constructor runs. This runs at import time, before exports are evaluated.
function ensureValidPrismaUrl() {
  if (typeof process === 'undefined') return

  const turso = getTursoConfig()
  const d1 = getCloudflareD1()

  // If using adapter (D1 or Turso), PRISMA_DATABASE_URL must be a valid file: URL
  // because prisma/schema.prisma says provider = "sqlite"
  if (d1 || turso) {
    if (!process.env.PRISMA_DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = 'file:db.sqlite'
    }
  } else {
    // Local dev: fall back to DATABASE_URL or default file path
    if (!process.env.PRISMA_DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL || 'file:./db/custom.db'
    }
  }
}

ensureValidPrismaUrl()

function createPrismaClient(): PrismaClient {
  // 1. Cloudflare D1
  const d1 = getCloudflareD1()
  if (d1) {
    const adapter = new PrismaD1(d1)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 2. Turso (Vercel production)
  const turso = getTursoConfig()
  if (turso) {
    const libsql = createClient({ url: turso.url, authToken: turso.authToken })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 3. Local SQLite fallback
  return new PrismaClient({ log: ['error'] })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
