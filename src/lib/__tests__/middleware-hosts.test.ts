import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '@/middleware';

/**
 * The addresses (middleware.ts + lib/hosts.ts): <factory>.floorbeat.in serves that factory alone,
 * its sign-in and everything else; superadmin.floorbeat.in takes the super admin only and
 * admin.floorbeat.in FloorBeat's staff, each sent to their own otherwise.
 */
const SECRET = 'middleware-hosts-test-secret-32-characters';

async function session(role: string, factoryId: string | null = null) {
  return new SignJWT({ typ: 'access', role, factory_id: factoryId, username: 'u' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('u1')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

async function visit(url: string, { role, factoryId = null, refresh = false }: { role?: string; factoryId?: string | null; refresh?: boolean } = {}) {
  const cookies = [];
  if (role) cookies.push(`esp_access=${await session(role, factoryId)}`);
  if (refresh) cookies.push('esp_refresh=r1');
  const res = await middleware(new NextRequest(new URL(url), { headers: cookies.length ? { cookie: cookies.join('; ') } : {} }));
  const location = res.headers.get('location');
  return { status: res.status, to: location ? new URL(location).href.replace(new URL(url).origin, '') : null, location };
}

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
  vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
  vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'ops.floorbeat.in,admin.floorbeat.in,superadmin.floorbeat.in');
  vi.stubEnv('STAFF_HOST_ROLES', 'superadmin.floorbeat.in=super_admin;admin.floorbeat.in=internal_admin,internal_viewer');
  vi.stubEnv('MARKETING_URL', 'https://floorbeat.in');
});
afterEach(() => vi.unstubAllEnvs());

const MILL = 'https://shree-mills.floorbeat.in';

describe('a factory\'s own address', () => {
  it('signed out: its sign-in; with a session to renew, that first', async () => {
    expect(await visit(`${MILL}/`)).toMatchObject({ status: 307, to: '/f/shree-mills/login' });
    expect((await visit(`${MILL}/`, { refresh: true })).to).toBe('/api/auth/session-restore?next=%2F');
    expect(await visit(`${MILL}/f/shree-mills/login`)).toMatchObject({ status: 200, to: null });
  });

  it('signed in: straight to its dashboard; its pages served', async () => {
    const own = { role: 'admin', factoryId: 'shree-mills' };
    expect((await visit(`${MILL}/`, own)).to).toBe('/factories/shree-mills');
    expect(await visit(`${MILL}/factories/shree-mills/energy`, own)).toMatchObject({ status: 200, to: null });
    expect((await visit(`${MILL}/f/shree-mills/login`, own)).to).toBe('/factories/shree-mills');   // signed in already
  });

  it('/login, /signup and /forgot-password are its own (the address in emails + "/login")', async () => {
    expect((await visit(`${MILL}/login`)).to).toBe('/f/shree-mills/login');
    expect((await visit(`${MILL}/login?next=%2Ffactories%2Fshree-mills%2Fenergy`)).to).toBe('/f/shree-mills/login?next=%2Ffactories%2Fshree-mills%2Fenergy');
    expect((await visit(`${MILL}/signup`)).to).toBe('/f/shree-mills/signup');
    expect((await visit(`${MILL}/forgot-password`)).to).toBe('/f/shree-mills/forgot-password');
    expect((await visit(`${MILL}/forgot-password/`)).to).toMatch(/^\/f\/shree-mills\/forgot-password\/?$/);   // Next keeps the slash, then drops it
  });

  it('another factory\'s pages are not served here', async () => {
    const own = { role: 'admin', factoryId: 'shree-mills' };
    expect((await visit(`${MILL}/factories/other-mill/energy`, own)).to).toBe('/');
    expect((await visit(`${MILL}/f/other-mill/login`)).to).toBe('/');
    expect((await visit(`${MILL}/factories/%E0%A4%A/x`, own)).to).toBe('/');   // a broken escape, no crash
  });

  it('signed in for another factory counts as signed out here, never renewed into a loop', async () => {
    const other = { role: 'admin', factoryId: 'other-mill', refresh: true };
    expect((await visit(`${MILL}/`, other)).to).toBe('/f/shree-mills/login');
    expect((await visit(`${MILL}/factories/shree-mills`, other)).to).toBe('/f/shree-mills/login?next=%2Ffactories%2Fshree-mills');
    expect(await visit(`${MILL}/f/shree-mills/login`, other)).toMatchObject({ status: 200, to: null });   // the form, to sign in
  });

  it('our staff see the factory; the staff console is not here', async () => {
    expect((await visit(`${MILL}/`, { role: 'super_admin' })).to).toBe('/factories/shree-mills');
    expect((await visit(`${MILL}/internal`, { role: 'super_admin' })).status).toBe(404);
  });

  it('the address is the Host header when nextUrl says otherwise (next dev puts localhost there)', async () => {
    const res = await middleware(new NextRequest(new URL('http://localhost:3005/'), { headers: { host: 'shree-mills.floorbeat.in' } }));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/f/shree-mills/login');
    const staff = await middleware(new NextRequest(new URL('http://localhost:3005/internal'), {
      headers: { host: 'superadmin.floorbeat.in', cookie: `esp_access=${await session('internal_admin')}` },
    }));
    expect(staff.headers.get('location')).toBe('http://admin.floorbeat.in/internal');
    const local = await middleware(new NextRequest(new URL('http://localhost:3005/internal'), {
      headers: { host: 'superadmin.floorbeat.in:3005', cookie: `esp_access=${await session('internal_admin')}` },
    }));
    expect(local.headers.get('location')).toBe('http://admin.floorbeat.in:3005/internal');   // a port is kept
  });

  it('FloorBeat\'s own addresses are not factories', async () => {
    expect((await visit('https://app.floorbeat.in/')).location).toBe('https://floorbeat.in/');   // the website, as before
    expect((await visit('https://admin.floorbeat.in/')).to).toBe('/internal/login');
  });
});

describe('app.floorbeat.in is gone: old links go to the factory\'s own address', () => {
  const APP = 'https://app.floorbeat.in';
  beforeEach(() => vi.stubEnv('STAFF_URL', 'https://ops.floorbeat.in/internal'));

  it('a factory\'s pages and sign-in, any case, path and query kept', async () => {
    expect((await visit(`${APP}/f/shree-mills/login`)).location).toBe('https://shree-mills.floorbeat.in/f/shree-mills/login');
    expect((await visit(`${APP}/f/shree-mills`)).location).toBe('https://shree-mills.floorbeat.in/f/shree-mills');
    expect((await visit(`${APP}/factories/Shree-Mills/energy?from=2026-11-01`)).location)
      .toBe('https://shree-mills.floorbeat.in/factories/Shree-Mills/energy?from=2026-11-01');
  });

  it('reset links: a factory account\'s to its address, a staff account\'s to the staff console', async () => {
    expect((await visit(`${APP}/reset-password?token=t1&factory=shree-mills`)).location)
      .toBe('https://shree-mills.floorbeat.in/reset-password?token=t1&factory=shree-mills');
    expect((await visit(`${APP}/reset-password?token=t2`)).location).toBe('https://ops.floorbeat.in/reset-password?token=t2');
  });

  it('anything else, and an ID that cannot be an address, go to the website', async () => {
    expect((await visit(`${APP}/`)).location).toBe('https://floorbeat.in/');
    expect((await visit(`${APP}/internal`)).location).toBe('https://floorbeat.in/');
    expect((await visit(`${APP}/f/mill_01/login`)).location).toBe('https://floorbeat.in/');
    expect((await visit('https://esp-iot-frontend-app.ashu131998.workers.dev/f/shree-mills/login')).location)
      .toBe('https://shree-mills.floorbeat.in/f/shree-mills/login');
  });

  it('stage and dev (no factory addresses) are as before', async () => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '');
    expect(await visit('https://stage-app.floorbeat.in/f/shree-mills/login')).toMatchObject({ status: 200, to: null });
  });
});

describe('stage and dev have factory addresses too', () => {
  it('<factory>.stage.floorbeat.in on the stage customer Worker: that factory, as in production', async () => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '.stage.floorbeat.in');
    vi.stubEnv('MARKETING_URL', 'https://stage-www.floorbeat.in');
    expect((await visit('https://factory-01.stage.floorbeat.in/')).to).toBe('/f/factory-01/login');
    expect((await visit('https://factory-01.stage.floorbeat.in/', { role: 'admin', factoryId: 'factory-01' })).to).toBe('/factories/factory-01');
    // its old address forwards there; its bare environment address goes to its website
    expect((await visit('https://stage-app.floorbeat.in/f/factory-01/login')).location).toBe('https://factory-01.stage.floorbeat.in/f/factory-01/login');
    expect((await visit('https://stage.floorbeat.in/')).location).toBe('https://stage-www.floorbeat.in/');
  });
});

describe('the staff addresses', () => {
  it('superadmin.floorbeat.in: the super admin only; staff are sent to admin', async () => {
    expect(await visit('https://superadmin.floorbeat.in/internal/boards', { role: 'super_admin' })).toMatchObject({ status: 200, to: null });
    expect((await visit('https://superadmin.floorbeat.in/internal', { role: 'internal_admin' })).location).toBe('https://admin.floorbeat.in/internal');
  });

  it('admin.floorbeat.in: staff only; the super admin is sent to superadmin', async () => {
    expect(await visit('https://admin.floorbeat.in/internal/factories', { role: 'internal_viewer' })).toMatchObject({ status: 200, to: null });
    expect((await visit('https://admin.floorbeat.in/internal', { role: 'super_admin' })).location).toBe('https://superadmin.floorbeat.in/internal');
  });

  it('ops takes every staff role, as before; a factory\'s people go home', async () => {
    expect((await visit('https://ops.floorbeat.in/internal', { role: 'internal_viewer' })).status).toBe(200);
    expect((await visit('https://ops.floorbeat.in/internal', { role: 'super_admin' })).status).toBe(200);
    expect((await visit('https://admin.floorbeat.in/internal', { role: 'admin', factoryId: 'shree-mills' })).to).toBe('/factories/shree-mills');
  });
});
