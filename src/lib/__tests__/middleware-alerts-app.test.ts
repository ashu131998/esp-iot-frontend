import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '@/middleware';

/**
 * The FloorBeat Alerts app's address (middleware.ts + lib/hosts.ts): alerts.floorbeat.in serves
 * the app at plain addresses — / the inbox, /alerts/<id>, /settings, /install — from the app's
 * /alerts-app/… inside; signed out, every address shows the sign-in in place (never a "login"
 * address: an iPhone's Safari before the app is installed); the staff console and factory pages
 * are not served there.
 */
const SECRET = 'middleware-alerts-app-test-secret-32-chars';

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
  const rewrite = res.headers.get('x-middleware-rewrite');
  const local = (u: string) => new URL(u).href.replace(new URL(u).origin, '');
  return { status: res.status, to: location ? local(location) : null, location, served: rewrite ? local(rewrite) : null, csp: res.headers.get('content-security-policy') };
}

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
  vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
  vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'ops.floorbeat.in,admin.floorbeat.in,superadmin.floorbeat.in');
  vi.stubEnv('MARKETING_URL', 'https://floorbeat.in');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

const APP = 'https://alerts.floorbeat.in';
const worker = { role: 'employee', factoryId: 'shree-mills' };

describe('signed out', () => {
  it('every address shows the sign-in in place: no redirect, never a "login" address', async () => {
    expect(await visit(`${APP}/`)).toMatchObject({ status: 200, to: null, served: '/alerts-app/login' });
    expect(await visit(`${APP}/alerts/ntf-1`)).toMatchObject({ status: 200, to: null, served: '/alerts-app/login' });
    expect((await visit(`${APP}/settings`)).served).toBe('/alerts-app/login');
  });

  it('a session that may still be renewed is renewed first (a notification tap after the 15 minutes)', async () => {
    expect((await visit(`${APP}/alerts/ntf-1`, { refresh: true })).to).toBe('/api/auth/session-restore?next=%2Falerts%2Fntf-1');
  });

  it('an old /login link goes to the page it named, or to the app\'s address; /install and the reset page need no sign-in', async () => {
    expect(await visit(`${APP}/login`)).toMatchObject({ status: 307, to: '/' });
    expect((await visit(`${APP}/login?next=%2Fsettings`)).to).toBe('/settings');
    expect((await visit(`${APP}/login?next=%2Falerts%2Fntf-1%3Fx%3D1`)).to).toBe('/alerts/ntf-1?x=1');
    expect((await visit(`${APP}/login?next=%2F%2Fevil.example`)).to).toBe('/');
    expect((await visit(`${APP}/login?next=%2Flogin`)).to).toBe('/');
    expect(await visit(`${APP}/install`)).toMatchObject({ status: 200, served: '/alerts-app/install' });
    expect(await visit(`${APP}/reset-password?token=t`)).toMatchObject({ status: 200, to: null, served: null });
  });
});

describe('signed in', () => {
  it('the inbox at /, an alert, the settings; /login goes to the inbox', async () => {
    expect(await visit(`${APP}/`, worker)).toMatchObject({ status: 200, to: null, served: '/alerts-app' });
    expect((await visit(`${APP}/alerts`, worker)).served).toBe('/alerts-app');
    expect((await visit(`${APP}/alerts/ntf-1`, worker)).served).toBe('/alerts-app/alerts/ntf-1');
    expect((await visit(`${APP}/settings`, worker)).served).toBe('/alerts-app/settings');
    expect((await visit(`${APP}/login`, worker)).to).toBe('/');
    expect((await visit(`${APP}/login?next=%2Fsettings`, worker)).to).toBe('/settings');
  });

  it('any account: a factory admin, a company admin, the super admin', async () => {
    expect((await visit(`${APP}/`, { role: 'admin', factoryId: 'shree-mills' })).served).toBe('/alerts-app');
    expect((await visit(`${APP}/settings`, { role: 'super_admin' })).served).toBe('/alerts-app/settings');
  });

  it('the app\'s inner address jumps to the plain one; factory pages and the staff console are not here', async () => {
    expect((await visit(`${APP}/alerts-app/settings`, worker)).to).toBe('/settings');
    expect((await visit(`${APP}/alerts-app`, worker)).to).toBe('/');
    expect((await visit(`${APP}/factories/shree-mills/energy`, worker)).to).toBe('/');
    expect((await visit(`${APP}/f/shree-mills/login`)).to).toBe('/');
    expect((await visit(`${APP}/internal`, { role: 'super_admin' })).status).toBe(404);
    expect((await visit(`${APP}/internal/login`)).status).toBe(404);
  });

  it('the old platform redirect for /alerts does not apply here', async () => {
    expect((await visit(`${APP}/alerts`, worker)).to).toBeNull();
  });
});

describe('the address', () => {
  it('stage\'s app is alerts.stage.floorbeat.in; production\'s name there is not it', async () => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '.stage.floorbeat.in');
    vi.stubEnv('MARKETING_URL', 'https://stage-www.floorbeat.in');
    expect((await visit('https://alerts.stage.floorbeat.in/', worker)).served).toBe('/alerts-app');
    expect((await visit('https://alerts.floorbeat.in/', worker)).served).not.toBe('/alerts-app');
  });

  it('a local run names it with ALERTS_APP_HOST', async () => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '');
    vi.stubEnv('ALERTS_APP_HOST', 'alerts.localhost');
    const res = await middleware(new NextRequest(new URL('http://localhost:3000/settings'), { headers: { host: 'alerts.localhost:3000', cookie: `esp_access=${await session('employee', 'shree-mills')}` } }));
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/alerts-app\/settings$/);
  });

  it('a factory\'s own address is untouched', async () => {
    expect((await visit('https://shree-mills.floorbeat.in/alerts', worker)).served).toBe('/factories/shree-mills/alerts');
  });
});

describe('the service worker', () => {
  it('is allowed by the content security policy (worker-src) on every page', async () => {
    expect((await visit(`${APP}/`)).csp).toContain("worker-src 'self'");
    expect((await visit('https://shree-mills.floorbeat.in/login')).csp).toContain("worker-src 'self'");
  });
});
