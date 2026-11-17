import { NextRequest, NextResponse } from 'next/server';

import { extractTokens, internalApiBase, isCsrfValid, setAuthCookies } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

import { csrfBootstrap } from '../_public-proxy';

/** GET /api/auth/app-login: a CSRF token for the sign-in form (and its cookie). */
export async function GET(req: NextRequest) {
  return csrfBootstrap(req);
}

/**
 * POST /api/auth/app-login -> Fastify POST /v1/auth/app-login: the alerts app's sign-in with an
 * email and a password, no factory. A choice of plants (409, `choose`) is passed back as it is;
 * a sign-in sets the session cookies and answers with the user.
 */
export async function POST(req: NextRequest) {
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
    upstream = await fetchWithSignal(`${internalApiBase()}/v1/auth/app-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the server. Try again.' }, { status: 502 });
  }
  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (upstream.status === 409 && Array.isArray(data.choose)) {
    return NextResponse.json({ error: data.error ?? 'Pick a factory', choose: data.choose }, { status: 409 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: (data?.error as string) ?? 'Invalid email or password' }, { status: upstream.status });
  }

  const tokens = extractTokens(data);
  if (!tokens) {
    return NextResponse.json({ error: 'Malformed auth response from API' }, { status: 502 });
  }
  const res = NextResponse.json({ user: data.user ?? null });
  setAuthCookies(res, tokens);
  return res;
}
