import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESERVED_SUBDOMAINS, factoryFromHost, imsAppHost, isImsAppHost } from '@/lib/hosts';
import { middleware } from '@/middleware';

/**
 * FloorBeat IMS, the stock app (middleware.ts + lib/hosts.ts): ims.floorbeat.in. Signed out, the
 * address asked for shows the sign-in in place; signed in, its plain addresses are served from
 * /ims-app/… inside; the staff console and the dashboard's long addresses are not served there.
 */
const SECRET = 'middleware-ims-app-test-secret-32-chars';

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
  return { status: res.status, to: location ? local(location) : null, served: rewrite ? local(rewrite) : null };
}

beforeEach(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
  vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
  vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'ops.floorbeat.in,admin.floorbeat.in,superadmin.floorbeat.in');
  vi.stubEnv('MARKETING_URL', 'https://floorbeat.in');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

const IMS = 'https://ims.floorbeat.in';
const worker = { role: 'employee', factoryId: 'shree-tiles' };

describe('the address', () => {
  it('is ims.<suffix>, or the one named for a local run; never a factory', () => {
    expect(imsAppHost('.floorbeat.in')).toBe('ims.floorbeat.in');
    expect(imsAppHost('.stage.floorbeat.in')).toBe('ims.stage.floorbeat.in');
    expect(imsAppHost('')).toBeNull();
    expect(isImsAppHost('IMS.floorbeat.in:443', '.floorbeat.in')).toBe(true);
    expect(isImsAppHost('ims.localhost:3105', null, 'ims.localhost')).toBe(true);
    expect(isImsAppHost('dashboard.floorbeat.in', '.floorbeat.in')).toBe(false);
    expect(RESERVED_SUBDOMAINS.has('ims')).toBe(true);
    expect(factoryFromHost('ims.floorbeat.in', '.floorbeat.in')).toBeNull();
  });
});

describe('signed out', () => {
  it('the address asked for shows the sign-in in place', async () => {
    expect(await visit(`${IMS}/`)).toMatchObject({ served: '/ims-app/login', to: null });
    expect(await visit(`${IMS}/stock?spec.colour=grey`)).toMatchObject({ served: '/ims-app/login?spec.colour=grey', to: null });
  });

  it('a kept session is renewed and comes back to the same address', async () => {
    const r = await visit(`${IMS}/stock`, { refresh: true });
    expect(r.to).toBe('/api/auth/session-restore?next=%2Fstock');
  });

  it('sign-in addresses, the staff console and the dashboard\'s long addresses go to /', async () => {
    for (const path of ['/login', '/signup', '/internal', '/internal/factories', '/f/shree-tiles/login', '/factories/shree-tiles']) {
      expect((await visit(`${IMS}${path}`)).to, path).toBe('/');
    }
  });
});

describe('signed in', () => {
  it('plain addresses are served from the app inside', async () => {
    expect(await visit(`${IMS}/`, worker)).toMatchObject({ served: '/ims-app', to: null });
    expect(await visit(`${IMS}/stock?row=R03`, worker)).toMatchObject({ served: '/ims-app/stock?row=R03', to: null });
  });

  it('the app\'s inside addresses go to their plain ones', async () => {
    expect((await visit(`${IMS}/ims-app/stock`, worker)).to).toBe('/stock');
    expect((await visit(`${IMS}/ims-app`, worker)).to).toBe('/');
  });

  it('no sign-in page, no console, no dashboard pages', async () => {
    for (const path of ['/login', '/internal', '/factories/shree-tiles/energy', '/f/x/login']) {
      expect((await visit(`${IMS}${path}`, worker)).to, path).toBe('/');
    }
  });

  it('elsewhere, /ims-app is not an IMS address (a factory\'s own address serves its dashboard)', async () => {
    const r = await visit('https://shree-tiles.floorbeat.in/ims-app', worker);
    expect(r.served).not.toBe('/ims-app');
  });
});
