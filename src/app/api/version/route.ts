import { NextResponse } from 'next/server';

// Simple version endpoint to verify which deployment is live
export async function GET() {
  return NextResponse.json({
    version: 'v17-60s-timeout-free-plan-compatible',
    timestamp: new Date().toISOString(),
    deployId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
  });
}
