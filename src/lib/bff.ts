import { type ApiRequestOptions, fetchWithSignal } from './request-signal';

const API_INTERNAL = process.env.API_INTERNAL_URL ?? 'http://localhost:8001';

export class BffError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'BffError';
  }
}

export async function backendFetch(
  path: string,
  init?: RequestInit & ApiRequestOptions & { accessToken?: string },
): Promise<Response> {
  const { accessToken, signal, timeoutMs, headers: initHeaders, body, ...fetchInit } = init ?? {};
  const headers = new Headers(initHeaders);
  if (!headers.has('Content-Type') && body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetchWithSignal(`${API_INTERNAL}${path}`, {
    ...fetchInit,
    body,
    headers,
    cache: 'no-store',
    signal,
    timeoutMs,
  });
}

export async function backendJson<T>(
  path: string,
  init?: RequestInit & ApiRequestOptions & { accessToken?: string },
): Promise<T> {
  const res = await backendFetch(path, init);
  if (!res.ok) {
    let message = res.statusText;
    let body: unknown;
    try {
      body = await res.json();
      if (body && typeof body === 'object' && 'error' in body) {
        message = String((body as { error: string }).error);
      }
    } catch {
      /* ignore */
    }
    throw new BffError(message, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function refreshTokens(refreshToken: string) {
  return backendJson<import('./auth-types').TokenResponse>('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
