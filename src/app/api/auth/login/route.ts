import { NextRequest, NextResponse } from 'next/server';

import {
  CSRF_COOKIE,
  extractTokens,
  generateCsrfToken,
  internalApiBase,
  setAuthCookies,
  setCsrfCookie,
} from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

/**
 * GET /api/auth/login -> bootstraps a readable CSRF token. Returns `{ csrf }` and
 * sets the `esp_csrf` cookie so the client can echo it via X-CSRF-Token.
 */
export async function GET(req: NextRequest) {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? generateCsrfToken();
  const res = NextResponse.json({ csrf: token });
  setCsrfCookie(res, token);
  return res;
}

/**
 * POST /api/auth/login -> Fastify POST /v1/auth/login.
 * On success the backend returns `{ access, refresh }` (and possibly `user`).
 * We set httpOnly access/refresh cookies + a readable csrf cookie, then return
 * the authenticated user (fetched from /v1/auth/me if not in the login body).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await fetchWithSignal(`${internalApiBase()}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: req.signal,
  });

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(
      { error: (data?.error as string) ?? 'Invalid credentials' },
      { status: upstream.status },
    );
  }

  const tokens = extractTokens(data);
  if (!tokens) {
    return NextResponse.json({ error: 'Malformed auth response from API' }, { status: 502 });
  }

  let user = (data.user as unknown) ?? null;
  if (!user) {
    const meRes = await fetchWithSignal(`${internalApiBase()}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
      cache: 'no-store',
      signal: req.signal,
    });
    if (meRes.ok) {
      const meJson = (await meRes.json().catch(() => null)) as Record<string, unknown> | null;
      user = meJson?.user ?? meJson ?? null;
    }
  }

  const res = NextResponse.json({ user });
  setAuthCookies(res, tokens);
  return res;
}
