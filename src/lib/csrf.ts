import { fetchWithSignal } from '@/lib/request-signal';

/** The readable double-submit cookie, or '' (browser only). */
export function csrfFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)esp_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

/**
 * The CSRF token for a public form (sign in, forgot password): the cookie when it is there, else
 * one from the route's GET, which also sets the cookie.
 */
export async function ensureCsrfToken(bootstrapUrl: string): Promise<string> {
  const existing = csrfFromCookie();
  if (existing) return existing;
  try {
    const res = await fetchWithSignal(bootstrapUrl, { credentials: 'same-origin' });
    const data = (await res.json().catch(() => ({}))) as { csrf?: string };
    return data.csrf ?? csrfFromCookie();
  } catch {
    return csrfFromCookie();
  }
}

/** POST JSON to a public BFF route with the CSRF header; returns the parsed body and status. */
export async function postPublic<T>(
  url: string,
  body: unknown,
  bootstrapUrl: string = url,
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const csrf = await ensureCsrfToken(bootstrapUrl);
  const res = await fetchWithSignal(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
