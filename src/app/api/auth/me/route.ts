import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  callRefresh,
  clearAuthCookies,
  internalApiBase,
  setAuthCookies,
} from '@/lib/server/bff';
import type { TokenPair } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

function fetchMe(accessToken: string, signal?: AbortSignal | null) {
  return fetchWithSignal(`${internalApiBase()}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  });
}

/**
 * GET /api/auth/me -> returns `{ user }` (or `{ user: null }` when logged out).
 * Auto-refreshes once on a 401 using the refresh cookie.
 */
export async function GET(req: NextRequest) {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!access && !refresh) {
    return NextResponse.json({ user: null });
  }

  let meRes = access ? await fetchMe(access, req.signal) : null;
  let rotated: TokenPair | null = null;

  if ((!meRes || meRes.status === 401) && refresh) {
    rotated = await callRefresh(refresh, req.signal);
    if (rotated) {
      meRes = await fetchMe(rotated.access, req.signal);
    }
  }

  if (!meRes || !meRes.ok) {
    const res = NextResponse.json({ user: null });
    clearAuthCookies(res);
    return res;
  }

  const meJson = (await meRes.json().catch(() => null)) as Record<string, unknown> | null;
  const user = meJson?.user ?? meJson ?? null;

  const res = NextResponse.json({ user });
  if (rotated) {
    setAuthCookies(res, rotated, req.cookies.get(CSRF_COOKIE)?.value);
  }
  return res;
}
