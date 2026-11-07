/**
 * GET /api/auth/handoff (app/api/auth/handoff/route.ts): a company's admin arriving from another
 * of its factories. The pass is traded for this address's own session, then on to the factory's
 * dashboard; anything wrong goes to the sign-in page, never an error page.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchWithSignal = vi.fn();
vi.mock('@/lib/request-signal', () => ({ fetchWithSignal: (...a: unknown[]) => fetchWithSignal(...a) }));

const { GET } = await import('@/app/api/auth/handoff/route');

const at = (url: string, host = new URL(url).host) => new NextRequest(new URL(url), { headers: { host, 'x-forwarded-proto': 'https' } });
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const TOKENS = { access_token: 'acc.ess.tok', refresh_token: 'ref.resh.tok', user: { factory_id: 'grp-b' } };

afterEach(() => fetchWithSignal.mockReset());

describe('the plant switcher\'s handoff', () => {
  it('a good pass: this address\'s session, then its dashboard', async () => {
    fetchWithSignal.mockResolvedValue(answer(200, TOKENS));
    const res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff?token=pass-123'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/factories/grp-b');
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('esp_access=acc.ess.tok');
    expect(cookies).toContain('esp_refresh=ref.resh.tok');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    const [url, init] = fetchWithSignal.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/auth\/handoff$/);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: 'pass-123' });
  });

  it('the address the browser used, not the one next dev reports', async () => {
    fetchWithSignal.mockResolvedValue(answer(200, TOKENS));
    const res = await GET(at('http://localhost:3005/api/auth/handoff?token=p', 'grp-b.localhost:3005'));
    expect(res.headers.get('location')).toBe('https://grp-b.localhost:3005/factories/grp-b');
  });

  it('an expired or used pass, no pass, or the API away: the sign-in page, no cookies', async () => {
    fetchWithSignal.mockResolvedValue(answer(401, { error: 'This link has been used: switch again' }));
    let res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff?token=old'));
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/login');
    expect(res.headers.get('set-cookie')).toBeNull();

    res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff'));
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/login');
    expect(fetchWithSignal).toHaveBeenCalledTimes(1);   // no call without a pass

    fetchWithSignal.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff?token=p'));
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/login');
  });

  it('an answer without tokens, or with a factory ID that cannot be an address: the sign-in page', async () => {
    fetchWithSignal.mockResolvedValueOnce(answer(200, { user: { factory_id: 'grp-b' } }));
    let res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff?token=p'));
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/login');
    fetchWithSignal.mockResolvedValueOnce(answer(200, { ...TOKENS, user: { factory_id: '../evil' } }));
    res = await GET(at('https://grp-b.floorbeat.in/api/auth/handoff?token=p'));
    expect(res.headers.get('location')).toBe('https://grp-b.floorbeat.in/login');
  });
});
