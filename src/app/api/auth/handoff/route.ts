import { NextRequest, NextResponse } from 'next/server';

import { extractTokens, internalApiBase, setAuthCookies } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

const FACTORY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** This address as the browser sees it (`next dev` puts localhost in nextUrl). */
function origin(req: NextRequest): string {
  const host = req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}

/**
 * GET /api/auth/handoff?token=… : a company's admin arriving from another of its factories (the
 * factory switcher). Each factory has its own address and cookies, so the one-time pass is traded
 * for this factory's own session (POST /v1/auth/handoff, the same device), then on to its
 * dashboard. A pass that has expired or been used goes to the sign-in page.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const fail = () => {
    const res = NextResponse.redirect(new URL('/login', origin(req)), 303);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };
  if (!token || token.length > 4096) return fail();

  const upstream = await fetchWithSignal(`${internalApiBase()}/v1/auth/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
    signal: req.signal,
  }).catch(() => null);
  if (!upstream?.ok) return fail();
  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  const tokens = extractTokens(data);
  const plant = (data.user as { factory_id?: unknown } | undefined)?.factory_id;
  if (!tokens || typeof plant !== 'string' || !FACTORY_ID_RE.test(plant)) return fail();

  // Its dashboard; at the factory's own address the long form becomes the plain one (middleware).
  const res = NextResponse.redirect(new URL(`/factories/${plant}`, origin(req)), 303);
  setAuthCookies(res, tokens);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
