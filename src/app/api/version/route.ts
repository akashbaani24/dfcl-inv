import { NextResponse } from 'next/server';

// Simple version endpoint to verify which deployment is live
export async function GET() {
  return NextResponse.json({
    version: 'v10-better-error-handling',
    timestamp: new Date().toISOString(),
    deployId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
  });
}
