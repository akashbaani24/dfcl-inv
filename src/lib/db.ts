import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

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
  if (url && authToken) return { url, authToken }
  return null
}

// Runtime debug log — visible in Vercel function logs
const debugLog: string[] = []
function log(msg: string) {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}`
  debugLog.push(line)
  if (typeof console !== 'undefined') console.error(line)
}

export function getDbDebugLog() { return debugLog.slice() }

function createPrismaClient(): PrismaClient {
  log('createPrismaClient() called')
  log(`  NODE_ENV=${process.env.NODE_ENV}`)
  log(`  VERCEL_ENV=${process.env.VERCEL_ENV}`)
  log(`  CF_PAGES=${process.env.CF_PAGES}`)
  log(`  TURSO_DATABASE_URL present=${!!process.env.TURSO_DATABASE_URL}`)
  log(`  TURSO_AUTH_TOKEN present=${!!process.env.TURSO_AUTH_TOKEN}`)
  log(`  DATABASE_URL present=${!!process.env.DATABASE_URL}`)
  log(`  DATABASE_URL starts with=${process.env.DATABASE_URL?.slice(0, 30) || 'NONE'}`)

  // 1. Cloudflare D1
  const d1 = getCloudflareD1()
  log(`  getCloudflareD1() returned: ${d1 ? 'D1 binding found' : 'null'}`)
  if (d1) {
    if (typeof process !== 'undefined') {
      process.env.DATABASE_URL = 'file:db.sqlite'
    }
    const adapter = new PrismaD1(d1)
    log('  Using PrismaD1 adapter')
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // 2. Turso
  const turso = getTursoConfig()
  log(`  getTursoConfig() returned: ${turso ? `url=${turso.url.slice(0, 40)}...` : 'null'}`)
  if (turso) {
    // Override DATABASE_URL to satisfy Prisma's schema validation
    if (typeof process !== 'undefined') {
      process.env.DATABASE_URL = 'file:db.sqlite'
      log(`  Overrode DATABASE_URL to file:db.sqlite`)
    }
    try {
      const libsql = createClient({
        url: turso.url,
        authToken: turso.authToken,
      })
      log(`  Created libsql client OK`)
      const adapter = new PrismaLibSql(libsql)
      log(`  Created PrismaLibSql adapter OK`)
      const client = new PrismaClient({ adapter, log: ['error'] })
      log(`  Created PrismaClient with adapter OK`)
      return client
    } catch (err) {
      log(`  ERROR creating PrismaClient with Turso adapter: ${String(err)}`)
      throw err
    }
  }

  // 3. Local SQLite fallback
  log('  Falling back to local SQLite (no adapter)')
  return new PrismaClient({
    log: ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()
log(`db initialized, type=${typeof db}`)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
