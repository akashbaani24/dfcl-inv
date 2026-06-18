import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __env?: { DB?: D1Database } | undefined
}

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

function getTursoConfig(): { url: string; authToken: string } | null {
  if (typeof process === 'undefined') return null
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (url && authToken && url !== 'undefined' && authToken !== 'undefined') {
    return { url, authToken }
  }
  return null
}

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
    // CRITICAL: PrismaLibSQL 6.x takes a Config object { url, authToken },
    // NOT a Client instance. Passing a Client was causing URL_INVALID errors
    // because the adapter was reading config.url which was undefined.
    const adapter = new PrismaLibSQL({
      url: turso.url,
      authToken: turso.authToken,
    })
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 3. Local SQLite fallback
  return new PrismaClient({ log: ['error'] })
}

let db: PrismaClient
try {
  db = globalForPrisma.prisma ?? createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
} catch (err) {
  const initError = err instanceof Error ? err : new Error(String(err))
  console.error('DB init failed:', initError.message)
  // Provide a fallback that throws on use, so API routes get meaningful errors
  db = new Proxy({} as PrismaClient, {
    get(_, prop) {
      if (prop === '$connect' || prop === '$disconnect') return async () => {}
      throw new Error(`DB init failed: ${initError.message}`)
    }
  })
}

export { db }
