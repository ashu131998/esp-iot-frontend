import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAIN_LINKS_HEADER } from '@/lib/factory-links';
import { middleware } from '@/middleware';

/**
 * The FloorBeat app's address, the dashboard on a phone (middleware.ts + lib/hosts.ts):
 * dashboard.floorbeat.in is one address for every factory. Signed out, the address asked for shows the
 * sign-in in place; signed in, it is the person's own factory at plain addresses, served from
 * /factories/<id>/… inside with links marked plain; our staff pick a factory and use its long
 * addresses; the staff console is not served there.
 */
const SECRET = 'middleware-dashboard-app-test-secret-32';

async function session(role: string, factoryId: string | null = null) {
  return new SignJWT({ typ: 'access', role, factory_id: factoryId, username: 'u' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('u1')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

type Who = { role?: string; factoryId?: string | null; refresh?: boolean; headers?: Record<string, string> };

async function visit(url: string, { role, factoryId = null, refresh = false, headers = {} }: Who = {}) {
  const cookies = [];
  if (role) cookies.push(`esp_access=${await session(role, factoryId)}`);
  if (refresh) cookies.push('esp_refresh=r1');
  const res = await middleware(new NextRequest(new URL(url), { headers: { ...headers, ...(cookies.length ? { cookie: cookies.join('; ') } : {}) } }));
  const location = res.headers.get('location');
  const rewrite = res.headers.get('x-middleware-rewrite');
  const local = (u: string) => new URL(u).href.replace(new URL(u).origin, '');
  return {
    status: res.status,
    to: location ? local(location) : null,
    served: rewrite ? local(rewrite) : null,
    // what the page is told: the header the middleware passes on, and whether the browser's own copy got through
    plain: res.headers.get(`x-middleware-request-${PLAIN_LINKS_HEADER}`),
    passed: (res.headers.get('x-middleware-override-headers') ?? '').split(','),
  };
}

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
  vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
  vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'ops.floorbeat.in,admin.floorbeat.in,superadmin.floorbeat.in');
  vi.stubEnv('MARKETING_URL', 'https://floorbeat.in');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

const APP = 'https://dashboard.floorbeat.in';
const worker = { role: 'employee', factoryId: 'shree-mills' };
const owner = { role: 'admin', factoryId: 'shree-mills' };
const staff = { role: 'super_admin', factoryId: null };

describe('signed out', () => {
  it('the address asked for shows the sign-in in place', async () => {
    expect(await visit(`${APP}/`)).toMatchObject({ status: 200, to: null, served: '/dashboard-app/login' });
    expect((await visit(`${APP}/alerts`)).served).toBe('/dashboard-app/login');
    expect((await visit(`${APP}/support?ticket=tkt-1`)).served).toBe('/dashboard-app/login?ticket=tkt-1');
    expect((await visit(`${APP}/factories/shree-mills/energy`)).served).toBe('/dashboard-app/login');
  });

  it('a session that may still be renewed is renewed first', async () => {
    expect((await visit(`${APP}/alerts`, { refresh: true })).to).toBe('/api/auth/session-restore?next=%2Falerts');
  });

  it('a factory\'s or the console\'s sign-in address is the app\'s own, at /; the reset page needs no sign-in', async () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/f/shree-mills/login', '/internal/login', '/internal']) {
      expect(await visit(`${APP}${path}`), path).toMatchObject({ status: 307, to: '/' });
    }
    expect(await visit(`${APP}/reset-password?token=t`)).toMatchObject({ status: 200, to: null, served: null });
    expect((await visit(`${APP}/dashboard-app/login`)).to).toBe('/');
  });
});

describe('someone of a factory, signed in', () => {
  it('the app is their own factory at plain addresses, its links marked plain', async () => {
    expect(await visit(`${APP}/`, worker)).toMatchObject({ status: 200, to: null, served: '/factories/shree-mills', plain: '1' });
    expect((await visit(`${APP}/alerts`, worker)).served).toBe('/factories/shree-mills/alerts');
    expect((await visit(`${APP}/machines/loom-3?from=2026-11-01`, worker)).served).toBe('/factories/shree-mills/machines/loom-3?from=2026-11-01');
    expect((await visit(`${APP}/support`, worker)).served).toBe('/factories/shree-mills/support');
  });

  it('a long address of their factory becomes the plain one; another factory\'s, a sign-in page or the console: home', async () => {
    expect((await visit(`${APP}/factories/shree-mills/energy?x=1`, worker)).to).toBe('/energy?x=1');
    expect((await visit(`${APP}/factories/Shree-Mills`, worker)).to).toBe('/');
    expect((await visit(`${APP}/factories/other-mill/energy?x=1`, worker)).to).toBe('/');
    expect((await visit(`${APP}/f/shree-mills/login`, worker)).to).toBe('/');
    for (const path of ['/login', '/signup', '/internal', '/internal/boards', '/dashboard-app/factories']) {
      expect((await visit(`${APP}${path}`, worker)).to, path).toBe('/');
    }
  });

  it('the Team page is for its admins', async () => {
    expect((await visit(`${APP}/team`, worker)).to).toBe('/');
    expect((await visit(`${APP}/team`, owner)).served).toBe('/factories/shree-mills/team');
  });

  it('an account of no factory that is not staff sees the sign-in', async () => {
    expect((await visit(`${APP}/`, { role: 'employee', factoryId: null })).served).toBe('/dashboard-app/login');
  });
});

describe('our staff', () => {
  it('pick a factory at /, then use its long addresses (links not plain)', async () => {
    expect(await visit(`${APP}/`, staff)).toMatchObject({ status: 200, served: '/dashboard-app/factories', plain: null });
    expect(await visit(`${APP}/factories/shree-mills/alerts`, staff)).toMatchObject({ status: 200, to: null, served: null, plain: null });
    expect((await visit(`${APP}/alerts`, staff)).to).toBe('/');
    expect((await visit(`${APP}/internal/boards`, staff)).to).toBe('/');
    expect((await visit(`${APP}/f/shree-mills/login`, staff)).to).toBe('/');
  });
});

describe('the app\'s address', () => {
  it('stage and a local run have their own', async () => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '.stage.floorbeat.in');
    expect((await visit('https://dashboard.stage.floorbeat.in/alerts', worker)).served).toBe('/factories/shree-mills/alerts');
    vi.stubEnv('FACTORY_HOST_SUFFIX', '');
    vi.stubEnv('DASHBOARD_APP_HOST', 'dashboard.localhost');
    vi.stubEnv('NODE_ENV', 'development');
    expect((await visit('http://dashboard.localhost:3105/', worker)).served).toBe('/factories/shree-mills');
  });

  it('only the middleware says where links are plain: the browser\'s own header is dropped everywhere', async () => {
    const sent = { headers: { [PLAIN_LINKS_HEADER]: '1' } };
    const atFactory = await visit('https://shree-mills.floorbeat.in/alerts', { ...worker, ...sent });
    expect(atFactory.served).toBe('/factories/shree-mills/alerts');
    expect(atFactory.plain).toBeNull();
    expect(atFactory.passed).not.toContain(PLAIN_LINKS_HEADER);
    const asStaff = await visit(`${APP}/factories/shree-mills/alerts`, { ...staff, ...sent });
    expect(asStaff.plain).toBeNull();
    expect(asStaff.passed).not.toContain(PLAIN_LINKS_HEADER);
    expect((await visit(`${APP}/alerts`, worker)).passed).toContain(PLAIN_LINKS_HEADER);
  });

  it('a factory\'s own address and the alerts app are as they were', async () => {
    expect((await visit('https://shree-mills.floorbeat.in/alerts', worker)).served).toBe('/factories/shree-mills/alerts');
    expect((await visit('https://alerts.floorbeat.in/', worker)).served).toBe('/alerts-app');
  });
});
