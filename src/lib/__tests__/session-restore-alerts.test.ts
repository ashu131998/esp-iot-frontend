/**
 * A session the alerts app cannot renew (app/api/auth/session-restore/route.ts): back to the page
 * asked for, signed out, where the app shows its sign-in in place (middleware.ts); never to a
 * "login" address (an iPhone's Safari before the app is installed). The failed renewal clears the
 * session cookies, so the page does not come straight back here.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { GET } = await import('@/app/api/auth/session-restore/route');

const restore = (next: string | null, cookie?: string) => {
  const url = `https://alerts.floorbeat.in/api/auth/session-restore${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return GET(new NextRequest(url, { headers: { host: 'alerts.floorbeat.in', ...(cookie ? { cookie } : {}) } }));
};

beforeEach(() => {
  vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a session the alerts app cannot renew', () => {
  it('no session left: back to the page asked for, or to the app\'s address', async () => {
    expect((await restore('/alerts/ntf-1')).headers.get('location')).toBe('https://alerts.floorbeat.in/alerts/ntf-1');
    expect((await restore(null)).headers.get('location')).toBe('https://alerts.floorbeat.in/');
    expect((await restore('/login')).headers.get('location')).toBe('https://alerts.floorbeat.in/');
  });

  it('a renewal the server refuses: back there with the session cookies cleared', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const res = await restore('/settings', 'esp_refresh=r-old');
    expect(res.headers.get('location')).toBe('https://alerts.floorbeat.in/settings');
    expect(res.headers.get('set-cookie')).toMatch(/esp_refresh=;[^,]*Max-Age=0/i);
  });
});
