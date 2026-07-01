import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  internalApiBase,
  isCsrfValid,
} from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

/**
 * POST /api/auth/logout -> Fastify POST /v1/auth/logout (best-effort session revoke),
 * then clears all auth cookies. Requires a valid double-submit CSRF token because
 * it mutates authenticated state.
 */
export async function POST(req: NextRequest) {
  if (!isCsrfValid(req)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  try {
    await fetchWithSignal(`${internalApiBase()}/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: 'no-store',
      signal: req.signal,
    });
  } catch {
    // Revoke is best-effort; always clear cookies regardless.
  }

  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
