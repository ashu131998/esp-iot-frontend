/**
 * Generic authenticated proxy: /api/v1/* -> Fastify /v1/*.
 *
 * - Injects the access token (httpOnly cookie) as `Authorization: Bearer ...`
 *   so the browser never sees the token.
 * - Validates the double-submit CSRF token on every non-GET request.
 * - Auto-refreshes once on a 401 using the refresh cookie, then retries.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  callRefresh,
  clearAuthCookies,
  internalApiBase,
  isCsrfValid,
  setAuthCookies,
} from '@/lib/server/bff';
import type { TokenPair } from '@/lib/server/bff';
import { fetchWithSignal } from '@/lib/request-signal';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function forward(
  target: string,
  method: string,
  accessToken: string,
  contentType: string | null,
  accept: string | null,
  body: ArrayBuffer | undefined,
  signal?: AbortSignal | null,
): Promise<Response> {
  const hasBody = Boolean(body && body.byteLength > 0);
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  // Only advertise a Content-Type when we're actually sending a body — otherwise
  // Fastify rejects an empty `application/json` request with 400 (FST_ERR_CTP_EMPTY_JSON_BODY).
  if (contentType && hasBody) headers['Content-Type'] = contentType;
  if (accept) headers['Accept'] = accept;

  return fetchWithSignal(target, {
    method,
    headers,
    body: hasBody ? body : undefined,
    cache: 'no-store',
    signal,
  });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const method = req.method.toUpperCase();
  const search = req.nextUrl.search;
  const target = `${internalApiBase()}/v1/${path.join('/')}${search}`;

  if (!SAFE_METHODS.has(method) && !isCsrfValid(req)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type');
  const accept = req.headers.get('accept');
  const body = SAFE_METHODS.has(method) ? undefined : await req.arrayBuffer();

  let token = access ?? '';
  let rotated: TokenPair | null = null;

  let upstream = token
    ? await forward(target, method, token, contentType, accept, body, req.signal)
    : new Response(null, { status: 401 });

  // Auto-refresh once on 401 (expired access token) when a refresh cookie exists.
  if (upstream.status === 401 && refresh) {
    rotated = await callRefresh(refresh, req.signal);
    if (rotated) {
      token = rotated.access;
      upstream = await forward(target, method, token, contentType, accept, body, req.signal);
    }
  }

  // 204/205/304 are "null body" statuses — constructing a Response with a body
  // (even an empty ArrayBuffer) for these throws, so pass null through.
  const nullBody = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  const buf = nullBody ? null : await upstream.arrayBuffer();
  const res = new NextResponse(buf, { status: upstream.status });
  const ct = upstream.headers.get('content-type');
  if (ct) res.headers.set('content-type', ct);

  if (rotated) {
    // Keep the same csrf value so concurrent client requests stay valid.
    setAuthCookies(res, rotated, req.cookies.get(CSRF_COOKIE)?.value);
  } else if (upstream.status === 401 && refresh) {
    // Refresh failed -> session is dead; clear cookies so the client redirects to login.
    clearAuthCookies(res);
  }

  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
