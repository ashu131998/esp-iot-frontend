import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { liveImageOrigin, livePath, liveRefusal } from '@/lib/live';
import { middleware } from '@/middleware';

describe('a camera\'s live view', () => {
  it('asks its factory\'s Cameras page, or ops for our super admin', () => {
    expect(livePath({ factoryId: 'mill' }, 'cam-a1')).toBe('/v1/factories/mill/cameras/cam-a1/live');
    expect(livePath(null, 'cam a1')).toBe('/v1/admin/boards/cam%20a1/live');
  });

  it('why it would not start, from the server\'s answer', () => {
    expect(liveRefusal({ body: { code: 'update-firmware' } })).toBe('update-firmware');
    expect(liveRefusal({ body: { code: 'offline' } })).toBe('offline');
    expect(liveRefusal({ body: { error: 'x' } })).toBe('other');
    expect(liveRefusal(new Error('network'))).toBe('other');
    expect(liveRefusal(null)).toBe('other');
  });

  it('where streams come from: the API\'s public address, else the one the dashboard calls; nothing that is not a web address', () => {
    expect(liveImageOrigin({ API_PUBLIC_ORIGIN: 'https://api.floorbeat.in/', API_INTERNAL_URL: 'https://x.duckdns.org' })).toBe('https://api.floorbeat.in');
    expect(liveImageOrigin({ API_INTERNAL_URL: 'http://localhost:8001/v1' })).toBe('http://localhost:8001');
    expect(liveImageOrigin({ API_PUBLIC_ORIGIN: ' ', API_INTERNAL_URL: 'not a url' })).toBeNull();
    expect(liveImageOrigin({ API_PUBLIC_ORIGIN: 'javascript:alert(1)' })).toBeNull();
    expect(liveImageOrigin({})).toBeNull();
  });
});

describe('the page\'s image policy lets the live view play', () => {
  const SECRET = 'live-view-test-secret-minimum-32-chars!';
  afterEach(() => vi.unstubAllEnvs());
  const cspOf = async () => {
    const token = await new SignJWT({ typ: 'access', role: 'employee', factory_id: 'mill', username: 'u' })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
    const res = await middleware(new NextRequest(new URL('https://mill.floorbeat.in/cameras'), { headers: { cookie: `esp_access=${token}` } }));
    return res.headers.get('content-security-policy') ?? '';
  };

  it('images from the page itself and from the API, nowhere else', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
    vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_PUBLIC_ORIGIN', 'https://api.floorbeat.in');
    expect(await cspOf()).toContain("img-src 'self' data: blob: https://api.floorbeat.in;");
    vi.stubEnv('API_PUBLIC_ORIGIN', '');
    vi.stubEnv('API_INTERNAL_URL', '');
    expect(await cspOf()).toContain("img-src 'self' data: blob:;");
  });
});
