import { NextRequest, NextResponse } from 'next/server';

import { afterSignIn } from '@/lib/alerts-app/model';
import { loginRedirectPath, safeNextPath } from '@/lib/auth-redirect';
import { isAlertsAppHost, isDashboardAppHost, isImsAppHost } from '@/lib/hosts';
import { LOCALE_COOKIE } from '@/lib/i18n/locale';
import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
  refreshSession,
  clearAuthCookies,
  setAuthCookies,
} from '@/lib/server/bff';

function loginFallback(req: NextRequest, next: string | null): URL {
  const base = req.nextUrl.origin;
  const path = next ?? '/';
  // The alerts app (alerts.floorbeat.in) shows its sign-in at the address asked for (middleware.ts):
  // back there, signed out now (the cookies are cleared), never to a "login" address.
  if (isAlertsAppHost(req.headers.get('host') ?? req.nextUrl.hostname, process.env.FACTORY_HOST_SUFFIX, process.env.ALERTS_APP_HOST)) {
    return new URL(afterSignIn(path), base);
  }
  // The FloorBeat app (dashboard.floorbeat.in) too: its sign-in shows in place at the address asked for.
  if (isDashboardAppHost(req.headers.get('host') ?? req.nextUrl.hostname, process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST)) {
    return new URL(path, base);
  }
  // FloorBeat IMS (ims.floorbeat.in) as well.
  if (isImsAppHost(req.headers.get('host') ?? req.nextUrl.hostname, process.env.FACTORY_HOST_SUFFIX, process.env.IMS_APP_HOST)) {
    return new URL(path, base);
  }
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
 * The API could not be asked to renew the session (a restart, the network): a small page that says so
 * and asks again by itself every few seconds. The session cookies stay as they are; going back to the
 * page would only come straight here again, and sending the person to sign in would sign them out for
 * nothing.
 */
const NOT_ANSWERING = {
  en: ['FloorBeat is not answering just now. Trying again…', 'Try again'],
  hi: ['FloorBeat अभी जवाब नहीं दे रहा। फिर से कोशिश हो रही है…', 'फिर कोशिश करें'],
  gu: ['FloorBeat હમણાં જવાબ નથી આપતું. ફરી પ્રયાસ થઈ રહ્યો છે…', 'ફરી પ્રયાસ કરો'],
} as const;

function notAnswering(req: NextRequest): NextResponse {
  const lang = req.cookies.get(LOCALE_COOKIE)?.value;
  const [words, again] = NOT_ANSWERING[lang === 'hi' || lang === 'gu' ? lang : 'en'];
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="5"><title>FloorBeat</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:90vh;align-items:center;justify-content:center;text-align:center;color:#0f172a;background:#f8fafc"><div><p style="font-size:1.1rem">${words}</p><p><a href="" style="color:#2563eb">${again}</a></p></div></body></html>`;
  return new NextResponse(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '5' } });
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

  const renewed = await refreshSession(refresh);
  const tokens = renewed.tokens;
  if (!tokens) {
    if (!renewed.refused) return notAnswering(req);
    const res = NextResponse.redirect(loginFallback(req, next));
    clearAuthCookies(res);
    return res;
  }

  const res = NextResponse.redirect(new URL(next ?? '/', req.url));
  setAuthCookies(res, tokens, req.cookies.get(CSRF_COOKIE)?.value);
  return res;
}
