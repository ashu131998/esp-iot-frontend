import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  internalApiBase,
  refreshSession,
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

/** The API's answer to "who is this", or null when it could not be asked (a restart, the network). */
async function askMe(accessToken: string, signal?: AbortSignal | null): Promise<Response | null> {
  try {
    return await fetchMe(accessToken, signal);
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/me -> returns `{ user }` (or `{ user: null }` when logged out).
 * Auto-refreshes once on a 401 using the refresh cookie.
 *
 * The session cookies are cleared only when the API says the session is over (a 401 it will not renew,
 * a 403). When the API cannot be asked (a restart's 502/503, a timeout), the answer is 503 and the
 * cookies stay: the next page load finds the session as it was. A renewed pair is always kept, even
 * when the question after it fails, since the old refresh token is spent once it is used.
 */
export async function GET(req: NextRequest) {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!access && !refresh) {
    return NextResponse.json({ user: null });
  }

  let meRes = access ? await askMe(access, req.signal) : new Response(null, { status: 401 });
  let rotated: TokenPair | null = null;
  let over = true;   // a 401 with no way to renew ends the session

  if (meRes?.status === 401 && refresh) {
    const renewed = await refreshSession(refresh);
    if (renewed.tokens) {
      rotated = renewed.tokens;
      meRes = await askMe(rotated.access, req.signal);
    } else {
      over = renewed.refused;
    }
  }

  const keepRotated = (res: NextResponse) => {
    if (rotated) setAuthCookies(res, rotated, req.cookies.get(CSRF_COOKIE)?.value);
    return res;
  };

  // Not asked, or not answered: the session is kept for the next try.
  if (!meRes || meRes.status >= 500 || (meRes.status === 401 && !over && !rotated)) {
    return keepRotated(NextResponse.json({ user: null, unavailable: true }, { status: 503 }));
  }

  if (!meRes.ok) {
    const res = NextResponse.json({ user: null });
    clearAuthCookies(res);
    return res;
  }

  const meJson = (await meRes.json().catch(() => null)) as Record<string, unknown> | null;
  const user = meJson?.user ?? meJson ?? null;
  return keepRotated(NextResponse.json({ user }));
}
