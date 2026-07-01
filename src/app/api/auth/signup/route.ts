import { NextRequest, NextResponse } from 'next/server';

import { CSRF_COOKIE, generateCsrfToken, internalApiBase, setCsrfCookie } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

/** GET /api/auth/signup -> bootstraps a readable CSRF token (`{ csrf }` + esp_csrf cookie). */
export async function GET(req: NextRequest) {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? generateCsrfToken();
  const res = NextResponse.json({ csrf: token });
  setCsrfCookie(res, token);
  return res;
}

/**
 * POST /api/auth/signup -> Fastify POST /v1/auth/signup.
 * Employee self-signup creates a `status=pending` user that cannot log in until
 * a factory admin approves it. No auth cookies are set here.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await fetchWithSignal(`${internalApiBase()}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: req.signal,
  });

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(
      { error: (data?.error as string) ?? 'Signup failed' },
      { status: upstream.status },
    );
  }

  return NextResponse.json(data, { status: upstream.status });
}
