/**
 * The session is cleared only when the API says it is over, never because the API could not be asked
 * (a restart's 502/503, a timeout): /api/auth/me, the /api/v1 proxy, /api/auth/refresh and
 * /api/auth/session-restore. A pair renewed on the way is always kept (the old refresh token is spent).
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshRefused } from '@/lib/server/bff';

const { GET: me } = await import('@/app/api/auth/me/route');
const { GET: proxy } = await import('@/app/api/v1/[...path]/route');
const { POST: refreshRoute } = await import('@/app/api/auth/refresh/route');
const { GET: restore } = await import('@/app/api/auth/session-restore/route');

const HOST = 'https://shree-mills.example.com';
const req = (path: string, cookie: string, init: { method?: string } = {}) =>
  new NextRequest(`${HOST}${path}`, { method: init.method ?? 'GET', headers: { cookie, host: 'shree-mills.example.com' } });

/** The API, by path: each answer a status (and a body), or 'down' for no answer at all. */
function api(routes: Record<string, Array<number | 'down' | { status: number; body: unknown }>>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    const queue = routes[path] ?? [404];
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (next === 'down') throw new TypeError('fetch failed');
    const { status, body } = typeof next === 'number' ? { status: next, body: {} } : next;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }));
  return calls;
}

const cleared = (res: Response) => /esp_refresh=;[^,]*Max-Age=0/i.test(res.headers.get('set-cookie') ?? '');
const renewedCookie = (res: Response) => /esp_refresh=r-new/.test(res.headers.get('set-cookie') ?? '');
const TOKENS = { status: 200, body: { access_token: 'a-new', refresh_token: 'r-new' } };
const USER = { status: 200, body: { user: { user_id: 'u1', role: 'employee', factory_id: 'shree-mills' } } };

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a refresh answer: "no" or "not now"', () => {
  it('a 4xx is the API saying no; a timeout, rate limit or 5xx is "not now"', () => {
    for (const s of [400, 401, 403, 404]) expect(refreshRefused(s), String(s)).toBe(true);
    for (const s of [408, 429, 500, 502, 503, 504]) expect(refreshRefused(s), String(s)).toBe(false);
  });
});

describe('/api/auth/me', () => {
  it('the API restarting (502) or not reachable: 503, cookies kept', async () => {
    api({ '/v1/auth/me': [502] });
    let res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);

    api({ '/v1/auth/me': ['down'] });
    res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);
  });

  it('an expired access and the refresh not answering: 503, cookies kept', async () => {
    api({ '/v1/auth/me': [401], '/v1/auth/refresh': [503] });
    const res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);
  });

  it('a refresh the API refuses: signed out, cookies cleared (as before)', async () => {
    api({ '/v1/auth/me': [401], '/v1/auth/refresh': [401] });
    const res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
    expect(cleared(res)).toBe(true);
  });

  it('renewed, then the question fails: the new pair is still kept', async () => {
    api({ '/v1/auth/me': [401, 502], '/v1/auth/refresh': [TOKENS] });
    const res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect(res.status).toBe(503);
    expect(renewedCookie(res)).toBe(true);
    expect(cleared(res)).toBe(false);
  });

  it('renewed and answered: the user, with the new pair', async () => {
    api({ '/v1/auth/me': [401, USER], '/v1/auth/refresh': [TOKENS] });
    const res = await me(req('/api/auth/me', 'esp_access=a; esp_refresh=r'));
    expect((await res.json()).user.user_id).toBe('u1');
    expect(renewedCookie(res)).toBe(true);
  });
});

describe('the /api/v1 proxy', () => {
  const call = (cookie: string) => proxy(req('/api/v1/me/alerts', cookie), { params: Promise.resolve({ path: ['me', 'alerts'] }) });

  it('an expired access and the refresh not answering: 503, cookies kept', async () => {
    api({ '/v1/me/alerts': [401], '/v1/auth/refresh': ['down'] });
    const res = await call('esp_access=a; esp_refresh=r');
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);
  });

  it('a refresh the API refuses: 401, cookies cleared (as before)', async () => {
    api({ '/v1/me/alerts': [401], '/v1/auth/refresh': [401] });
    const res = await call('esp_access=a; esp_refresh=r');
    expect(res.status).toBe(401);
    expect(cleared(res)).toBe(true);
  });

  it('the API answering 502 itself: passed on, cookies kept', async () => {
    api({ '/v1/me/alerts': [502] });
    const res = await call('esp_access=a; esp_refresh=r');
    expect(res.status).toBe(502);
    expect(cleared(res)).toBe(false);
  });
});

describe('/api/auth/refresh', () => {
  it('not answering: 503, cookies kept; refused: 401, cleared', async () => {
    api({ '/v1/auth/refresh': [502] });
    let res = await refreshRoute(req('/api/auth/refresh', 'esp_refresh=r', { method: 'POST' }));
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);

    api({ '/v1/auth/refresh': [401] });
    res = await refreshRoute(req('/api/auth/refresh', 'esp_refresh=r', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect(cleared(res)).toBe(true);
  });
});

describe('/api/auth/session-restore', () => {
  it('the refresh not answering: a page that tries again by itself, in the person\'s language; cookies kept', async () => {
    api({ '/v1/auth/refresh': [503] });
    const res = await restore(req('/api/auth/session-restore?next=%2Fenergy', 'esp_refresh=r; fb_lang=hi'));
    expect(res.status).toBe(503);
    expect(cleared(res)).toBe(false);
    expect(res.headers.get('location')).toBeNull();
    const html = await res.text();
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('FloorBeat अभी जवाब नहीं दे रहा');
  });

  it('a refresh the API refuses: to sign in, cookies cleared (as before)', async () => {
    api({ '/v1/auth/refresh': [401] });
    const res = await restore(req('/api/auth/session-restore?next=%2Fenergy', 'esp_refresh=r'));
    expect(res.status).toBe(307);
    expect(cleared(res)).toBe(true);
  });
});
