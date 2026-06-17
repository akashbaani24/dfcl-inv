// Cloudflare Pages environment bindings type declarations

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
  exec(query: string): Promise<D1Result>
  createBinding(): unknown
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

interface D1Result<T = unknown> {
  results?: T[]
  success: boolean
  meta?: Record<string, unknown>
}

interface CloudflareEnv {
  DB: D1Database
}

declare global {
  // eslint-disable-next-line no-var
  var __cf_env: CloudflareEnv | undefined
}

export {}
