/**
 * The alerts app's calls, through the BFF (/api/v1/me/* → query-api /v1/me/*; /api/auth/app-login
 * for signing in). Cookies carry the session; the CSRF cookie is echoed on every write.
 */
import { getClientCsrf } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/auth-types';
import { ensureCsrfToken } from '@/lib/csrf';
import { fetchWithSignal } from '@/lib/request-signal';

import type { MyAlert, MyAlertsPage, Plant, PushKey, PushSubscriptionBody, ReplyResult, TestPushResult } from './types';

export class AlertsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown = null,
  ) {
    super(message);
    this.name = 'AlertsApiError';
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal | null } = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = getClientCsrf();
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetchWithSignal(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new AlertsApiError(message, res.status, data);
  }
  return data as T;
}

const ME = '/api/v1/me';

export const alertsApi = {
  key: (signal?: AbortSignal | null) => call<PushKey>(`${ME}/push/key`, { signal }),
  subscribe: (body: PushSubscriptionBody) => call<{ subscription_id: string; devices: number }>(`${ME}/push/subscriptions`, { method: 'POST', body }),
  unsubscribe: (endpoint: string) => call<{ removed: boolean }>(`${ME}/push/subscriptions`, { method: 'DELETE', body: { endpoint } }),
  testPush: () => call<TestPushResult>(`${ME}/push/test`, { method: 'POST' }),

  alerts: (params: { limit?: number; unread?: boolean } = {}, signal?: AbortSignal | null) => {
    const search = new URLSearchParams();
    if (params.limit) search.set('limit', String(params.limit));
    if (params.unread) search.set('unread', '1');
    const qs = search.toString();
    return call<MyAlertsPage>(`${ME}/alerts${qs ? `?${qs}` : ''}`, { signal });
  },
  alert: (id: string, signal?: AbortSignal | null) => call<MyAlert>(`${ME}/alerts/${encodeURIComponent(id)}`, { signal }),
  markRead: (id: string) => call<{ read_at: string }>(`${ME}/alerts/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => call<{ read: number }>(`${ME}/alerts/read-all`, { method: 'POST' }),
  reply: (id: string, optionId: string) => call<ReplyResult>(`${ME}/alerts/${encodeURIComponent(id)}/reply`, { method: 'POST', body: { option_id: optionId } }),

  /** The plants this account can be at, by name, and the one it is at (for the settings page). */
  plants: (signal?: AbortSignal | null) => call<{ plants: Plant[]; current: string | null }>('/api/v1/auth/plants', { signal }),
};

export interface AppLoginResult {
  user: AuthUser | null;
  /** Several plants sign in with this email and password: the person picks one and signs in again. */
  choose: Plant[] | null;
}

/** Sign in with an email and a password (and a plant, once chosen). Throws AlertsApiError when refused. */
export async function appLogin(body: { email: string; password: string; factory_id?: string | null }): Promise<AppLoginResult> {
  const csrf = await ensureCsrfToken('/api/auth/app-login');
  const res = await fetchWithSignal('/api/auth/app-login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: AuthUser; choose?: Plant[]; error?: string };
  if (res.status === 409 && Array.isArray(data.choose)) return { user: null, choose: data.choose };
  if (!res.ok) throw new AlertsApiError(data.error ?? `Request failed (${res.status})`, res.status, data);
  return { user: data.user ?? null, choose: null };
}
