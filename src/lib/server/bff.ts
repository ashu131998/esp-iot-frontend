/**
 * Server-only BFF helpers: cookie names/options, CSRF (double-submit) checks,
 * and token refresh against the Fastify API. Never import this from client code.
 */
import type { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '@/lib/auth-types';
import { fetchWithSignal } from '@/lib/request-signal';

// Single source of truth for cookie names lives in auth-types (client-safe).
export { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE };
export const CSRF_HEADER = 'x-csrf-token';

// Token lifetimes (cookie maxAge). The backend remains authoritative on actual
// JWT expiry; these just bound how long the browser retains the cookies.
const ACCESS_MAX_AGE = 60 * 15; // 15 minutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

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

/** Rotates tokens via the backend refresh endpoint. Returns null on failure. */
export async function callRefresh(
  refreshToken: string,
  signal?: AbortSignal | null,
): Promise<TokenPair | null> {
  try {
    const res = await fetchWithSignal(`${internalApiBase()}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return extractTokens(data);
  } catch {
    return null;
  }
}
