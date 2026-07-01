import 'server-only';

import { cookies } from 'next/headers';

import { ACCESS_COOKIE } from '@/lib/auth-types';
import { type ApiRequestOptions, fetchWithSignal } from '@/lib/request-signal';

const API_INTERNAL = process.env.API_INTERNAL_URL ?? 'http://localhost:8001';

/** Authenticated fetch to Fastify — for server components and route handlers. */
export async function internalApiFetch(
  path: string,
  init?: RequestInit & ApiRequestOptions,
): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  const { signal, timeoutMs, headers: initHeaders, ...fetchInit } = init ?? {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(initHeaders as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetchWithSignal(`${API_INTERNAL}${path}`, {
    ...fetchInit,
    headers,
    cache: 'no-store',
    signal,
    timeoutMs,
  });
}
