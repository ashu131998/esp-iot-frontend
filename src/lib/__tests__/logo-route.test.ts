import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/logo/[factoryId]/route';

const call = (factoryId: string) => GET(new Request('https://app.test/api/logo/x'), { params: Promise.resolve({ factoryId }) });

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/logo/[factoryId]', () => {
  it('passes the logo through from the API with safe, cacheable headers', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('factory 01');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/public\/factories\/factory%2001\/logo$/);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('answers 404 when the factory has no logo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"No logo"}', { status: 404 })));
    expect((await call('factory-01')).status).toBe(404);
  });

  it('answers 502 for API errors, a non-image answer, or no answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    expect((await call('factory-01')).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })));
    expect((await call('factory-01')).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x')));
    expect((await call('factory-01')).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]))));   // no content type
    expect((await call('factory-01')).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await call('factory-01')).status).toBe(502);
  });
});
