import { NextRequest, NextResponse } from 'next/server';

import { loginRedirectPath, safeNextPath } from '@/lib/auth-redirect';
import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
  callRefresh,
  clearAuthCookies,
  setAuthCookies,
} from '@/lib/server/bff';

function loginFallback(req: NextRequest, next: string | null): URL {
  const base = req.nextUrl.origin;
  const path = next ?? '/';
  const factoryMatch = path.match(/^\/factories\/([^/?#]+)/);
  if (factoryMatch) {
    const [pathname, ...rest] = path.split('?');
    const search = rest.length ? `?${rest.join('?')}` : '';
    const login = loginRedirectPath(factoryMatch[1], pathname, search);
    return new URL(login, base);
  }
  if (path.startsWith('/internal')) {
    const url = new URL('/internal/login', base);
    if (safeNextPath(path)) url.searchParams.set('next', path);
    return url;
  }
  return new URL('/internal/login', base);
}

/**
 * GET /api/auth/session-restore?next=/path
 * Rotates tokens using the refresh cookie and redirects back — used by edge
 * middleware when the 15-minute access JWT expired but the 7-day session remains.
 */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'));
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!refresh) {
    return NextResponse.redirect(loginFallback(req, next));
  }

  const tokens = await callRefresh(refresh);
  if (!tokens) {
    const res = NextResponse.redirect(loginFallback(req, next));
    clearAuthCookies(res);
    return res;
  }

  const res = NextResponse.redirect(new URL(next ?? '/', req.url));
  setAuthCookies(res, tokens, req.cookies.get(CSRF_COOKIE)?.value);
  return res;
}
