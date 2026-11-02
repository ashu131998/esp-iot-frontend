import { NextRequest, NextResponse } from 'next/server';

import { CSRF_COOKIE, generateCsrfToken, internalApiBase, isCsrfValid, setCsrfCookie } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

/**
 * The public account routes (forgot password, reset) share one shape: GET hands the page a CSRF
 * token (and sets the cookie), POST checks the double-submit token and forwards the JSON body to
 * the Fastify route, passing its status and body back. No auth cookies are involved.
 */
export function csrfBootstrap(req: NextRequest): NextResponse {
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? generateCsrfToken();
  const res = NextResponse.json({ csrf: token });
  setCsrfCookie(res, token);
  return res;
}

export async function forwardPublicPost(req: NextRequest, upstreamPath: string, failMessage: string): Promise<NextResponse> {
  if (!isCsrfValid(req)) {
    return NextResponse.json({ error: 'Please refresh the page and try again.' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetchWithSignal(`${internalApiBase()}${upstreamPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: failMessage }, { status: 502 });
  }
  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  if (!upstream.ok) {
    return NextResponse.json(
      { error: (data?.error as string) ?? failMessage, reason: data?.reason },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data, { status: upstream.status });
}
