import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Try to get token from both cookie and Authorization header
  let token = request.cookies.get('session_token')?.value;

  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('session_token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
