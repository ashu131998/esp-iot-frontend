/**
 * Server-only BFF helpers: cookie names/options, CSRF (double-submit) checks,
 * and token refresh against the Fastify API. Never import this from client code.
 */
import type { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE } from '@/lib/auth-types';
import { isStaffRole, staffHomePath } from '@/lib/internal-auth';
import { fetchWithSignal } from '@/lib/request-signal';

// Single source of truth for cookie names lives in auth-types (client-safe).
export { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE };
export const CSRF_HEADER = 'x-csrf-token';

// Token lifetimes (cookie maxAge). The backend remains authoritative on actual
// JWT expiry; these just bound how long the browser retains the cookies.
const ACCESS_MAX_AGE = 60 * 15; // 15 minutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (REFRESH_TOKEN_TTL on the API): the alerts app must not sign itself out

export interface TokenPair {
  access: string;
  refresh: string;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Server-side base URL for the Fastify API. Never exposed to the browser. */
export function internalApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8001'
  );
}

/**
 * Parent domain (e.g. `.floorbeat.in`) for the session hint cookie, so the
 * marketing site on the apex can send signed-in users to their dashboard.
 * Unset: no hint cookie is written (workers.dev / local dev).
 */
function sessionHintDomain(): string | undefined {
  return process.env.SESSION_HINT_COOKIE_DOMAIN?.trim() || undefined;
}

const FACTORY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Home path for the signed-in user, read from the (unverified) access token
 * payload. Only used for the cross-subdomain redirect hint, never for access.
 */
export function homePathFromAccessToken(access: string): string | null {
  const part = access.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: unknown; factory_id?: unknown };
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    if (isStaffRole(role)) return staffHomePath();
    const factoryId = typeof payload.factory_id === 'string' ? payload.factory_id : null;
    if (factoryId && FACTORY_ID_RE.test(factoryId)) return `/factories/${factoryId}`;
    return null;
  } catch {
    return null;
  }
}

export function generateCsrfToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/** Sets httpOnly access/refresh cookies plus a fresh readable csrf cookie. */
export function setAuthCookies(res: NextResponse, tokens: TokenPair, csrfToken?: string): void {
  const secure = isProd();
  res.cookies.set(ACCESS_COOKIE, tokens.access, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
  res.cookies.set(CSRF_COOKIE, csrfToken ?? generateCsrfToken(), {
    httpOnly: false, // readable by the client so it can echo it in the X-CSRF-Token header
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
  const hintDomain = sessionHintDomain();
  const home = hintDomain ? homePathFromAccessToken(tokens.access) : null;
  if (hintDomain && home) {
    res.cookies.set(SESSION_HINT_COOKIE, home, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain: hintDomain,
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    });
  }
}

/** Sets just the readable csrf cookie and returns the token (used to bootstrap CSRF). */
export function setCsrfCookie(res: NextResponse, csrfToken?: string): string {
  const token = csrfToken ?? generateCsrfToken();
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProd(),
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
  return token;
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    res.cookies.set(name, '', {
      httpOnly: name !== CSRF_COOKIE,
      secure: isProd(),
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  }
  const hintDomain = sessionHintDomain();
  if (hintDomain) {
    res.cookies.set(SESSION_HINT_COOKIE, '', {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      domain: hintDomain,
      path: '/',
      maxAge: 0,
    });
  }
}

/**
 * Double-submit CSRF check: the readable `csrf` cookie value must match the
 * `X-CSRF-Token` request header. Applied to all non-GET BFF calls.
 */
export function isCsrfValid(req: NextRequest): boolean {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get(CSRF_HEADER);
  return Boolean(cookie) && Boolean(header) && cookie === header;
}

/**
 * Reads an access/refresh pair from a backend JSON body, tolerating both
 * `{ access, refresh }` and `{ access_token, refresh_token }` naming. The exact
 * field names are a backend-contract detail the verification agent should confirm.
 */
export function extractTokens(data: Record<string, unknown> | null | undefined): TokenPair | null {
  if (!data) return null;
  const access = (data.access ?? data.access_token) as string | undefined;
  const refresh = (data.refresh ?? data.refresh_token) as string | undefined;
  if (!access || !refresh) return null;
  return { access, refresh };
}

// Single-flight refresh. Refresh tokens are single-use on the backend (each use
// revokes the prior jti). When the access token expires, one page navigation
// fires several API calls at once — each would otherwise spend the SAME refresh
// token, and every loser after the first gets a revoked-token 401 that wipes the
// whole session mid-flight (stranding in-flight useSuspenseQuery fetches on their
// skeletons). Coalescing concurrent refreshes for the same token into one call
// means they all share one rotation and one resulting token pair.
const inflightRefresh = new Map<string, Promise<RefreshOutcome>>();

/**
 * What came of renewing a session:
 *  - { tokens }: renewed;
 *  - { refused: true }: the API said no (the refresh token is spent, revoked or unknown): the session is over;
 *  - { refused: false }: the API could not be asked (a restart's 502/503, a timeout, the network). The
 *    session may well be fine: it is kept, and the next request tries again. Signing everyone out
 *    because the API was restarting for a few seconds would be the wrong answer.
 */
export type RefreshOutcome = { tokens: TokenPair } | { tokens: null; refused: boolean };

/** Whether an answer of the refresh endpoint means "no" (the session is over) rather than "not now". */
export function refreshRefused(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Rotates tokens via the backend refresh endpoint, telling a refusal from the API not answering. */
export async function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  const existing = inflightRefresh.get(refreshToken);
  if (existing) return existing;

  const pending = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetchWithSignal(`${internalApiBase()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) return { tokens: null, refused: refreshRefused(res.status) };
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const tokens = extractTokens(data);
      return tokens ? { tokens } : { tokens: null, refused: false };
    } catch {
      return { tokens: null, refused: false };
    }
  })();

  inflightRefresh.set(refreshToken, pending);
  try {
    return await pending;
  } finally {
    inflightRefresh.delete(refreshToken);
  }
}

/** Rotates tokens via the backend refresh endpoint. Returns null on failure (of either kind: see refreshSession). */
export async function callRefresh(
  refreshToken: string,
  // Kept for call-site compatibility but intentionally NOT forwarded: a shared
  // refresh must not be aborted just because one caller's request was cancelled
  // (fetchWithSignal still applies its own timeout).
  _signal?: AbortSignal | null,
): Promise<TokenPair | null> {
  return (await refreshSession(refreshToken)).tokens;
}
