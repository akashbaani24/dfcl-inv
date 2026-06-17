import { NextResponse } from 'next/server';

// Debug endpoint — shows which env vars are visible at runtime
// No sensitive values, just true/false status and partial prefixes
export async function GET() {
  const envStatus = {
    TURSO_DATABASE_URL: !!process.env.TURSO_DATABASE_URL,
    TURSO_DATABASE_URL_LENGTH: process.env.TURSO_DATABASE_URL?.length || 0,
    TURSO_DATABASE_URL_STARTS_WITH: process.env.TURSO_DATABASE_URL?.slice(0, 30) || 'MISSING',
    TURSO_AUTH_TOKEN: !!process.env.TURSO_AUTH_TOKEN,
    TURSO_AUTH_TOKEN_LENGTH: process.env.TURSO_AUTH_TOKEN?.length || 0,
    DATABASE_URL: !!process.env.DATABASE_URL,
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0,
    DATABASE_URL_STARTS_WITH: process.env.DATABASE_URL?.slice(0, 30) || 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION,
    CF_PAGES: process.env.CF_PAGES,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(envStatus, { status: 200 });
}
