import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __env?: { DB?: D1Database } | undefined
  __dbInitError?: Error | undefined
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
  try {
    // 1. Cloudflare D1
    const d1 = getCloudflareD1()
    if (d1) {
      const adapter = new PrismaD1(d1)
      return new PrismaClient({ adapter, log: ['error'] })
    }

    // 2. Turso (Vercel production)
    const turso = getTursoConfig()
    if (turso) {
      // Validate URL before passing to libsql
      if (!turso.url || !turso.url.startsWith('libsql://') && !turso.url.startsWith('http')) {
        throw new Error(`Invalid Turso URL: ${JSON.stringify(turso.url?.slice(0, 50))}`)
      }
      const libsql = createClient({ url: turso.url, authToken: turso.authToken })
      const adapter = new PrismaLibSQL(libsql)
      return new PrismaClient({ adapter, log: ['error'] })
    }

    // 3. Local SQLite fallback
    return new PrismaClient({ log: ['error'] })
  } catch (err) {
    // Store the error so we can return it from API routes
    globalForPrisma.__dbInitError = err instanceof Error ? err : new Error(String(err))
    // Re-throw so caller knows something went wrong
    throw err
  }
}

let db: PrismaClient
try {
  db = globalForPrisma.prisma ?? createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
} catch (err) {
  // On Vercel, if Prisma fails to initialize, expose a fake db object
  // that throws on any access, so the API route can return a meaningful error
  const initError = err instanceof Error ? err : new Error(String(err))
  globalForPrisma.__dbInitError = initError
  db = new Proxy({} as PrismaClient, {
    get(_, prop) {
      if (prop === '$connect' || prop === '$disconnect') return async () => {}
      throw new Error(`DB initialization failed: ${initError.message}`)
    }
  })
}

export { db }
export function getDbInitError() { return globalForPrisma.__dbInitError }
