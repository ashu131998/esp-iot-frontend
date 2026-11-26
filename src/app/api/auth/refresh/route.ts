import { NextRequest, NextResponse } from 'next/server';

import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
  refreshSession,
  clearAuthCookies,
  setAuthCookies,
} from '@/lib/server/bff';

/**
 * POST /api/auth/refresh -> rotates tokens via Fastify POST /v1/auth/refresh.
 * Uses the httpOnly refresh cookie (never the request body) and re-sets cookies.
 * SameSite=Strict on the refresh cookie already protects this from cross-site use,
 * so no separate CSRF token is required here.
 */
export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const renewed = await refreshSession(refresh);
  const tokens = renewed.tokens;
  if (!tokens) {
    // The API not answering (a restart) is not the end of the session: the cookies stay.
    if (!renewed.refused) return NextResponse.json({ error: 'FloorBeat is not answering just now. Try again in a moment.' }, { status: 503 });
    const res = NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, tokens, req.cookies.get(CSRF_COOKIE)?.value);
  return res;
}
