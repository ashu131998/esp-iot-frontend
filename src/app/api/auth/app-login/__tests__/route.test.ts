/**
 * POST /api/auth/app-login (app/api/auth/app-login/route.ts): the alerts app's sign-in through
 * the BFF. A sign-in sets the session cookies; a choice of plants comes back as it is; a refusal
 * keeps its reason; no CSRF token, no call.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchWithSignal = vi.fn();
vi.mock('@/lib/request-signal', () => ({ fetchWithSignal: (...a: unknown[]) => fetchWithSignal(...a) }));

const { GET, POST } = await import('@/app/api/auth/app-login/route');

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const post = (body: unknown, { csrf = true }: { csrf?: boolean } = {}) =>
  new NextRequest(new URL('https://alerts.floorbeat.in/api/auth/app-login'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrf ? { cookie: 'esp_csrf=tok-1', 'x-csrf-token': 'tok-1' } : {}),
    },
    body: JSON.stringify(body),
  });
const TOKENS = { access_token: 'acc.ess.tok', refresh_token: 'ref.resh.tok', expires_in: 900, user: { user_id: 'u1', factory_id: 'mill', role: 'employee' } };

afterEach(() => fetchWithSignal.mockReset());

describe('the alerts app\'s sign-in', () => {
  it('signs in: the session cookies and the user', async () => {
    fetchWithSignal.mockResolvedValue(answer(200, TOKENS));
    const res = await POST(post({ email: 'ravi@mill.in', password: 'pw' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: TOKENS.user });
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('esp_access=acc.ess.tok');
    expect(cookies).toContain('esp_refresh=ref.resh.tok');
    const [url, init] = fetchWithSignal.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/auth\/app-login$/);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: 'ravi@mill.in', password: 'pw' });
  });

  it('a choice of plants comes back as it is, with no cookies', async () => {
    const choose = [{ factory_id: 'mill-01', name: 'Shree Mills' }, { factory_id: 'mill-03', name: 'Surat Unit' }];
    fetchWithSignal.mockResolvedValue(answer(409, { error: 'pick one', choose }));
    const res = await POST(post({ email: 'ravi@mill.in', password: 'pw' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'pick one', choose });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('a refusal keeps its reason', async () => {
    fetchWithSignal.mockResolvedValue(answer(401, { error: 'Invalid email or password' }));
    const res = await POST(post({ email: 'ravi@mill.in', password: 'wrong' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid email or password' });
  });

  it('no CSRF token: refused before any call; a bad body too', async () => {
    const res = await POST(post({ email: 'ravi@mill.in', password: 'pw' }, { csrf: false }));
    expect(res.status).toBe(403);
    expect(fetchWithSignal).not.toHaveBeenCalled();
    const bad = new NextRequest(new URL('https://alerts.floorbeat.in/api/auth/app-login'), { method: 'POST', headers: { cookie: 'esp_csrf=t', 'x-csrf-token': 't' }, body: '{not json' });
    expect((await POST(bad)).status).toBe(400);
  });

  it('the API away, or an answer without tokens: a plain error, no cookies', async () => {
    fetchWithSignal.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    let res = await POST(post({ email: 'ravi@mill.in', password: 'pw' }));
    expect(res.status).toBe(502);
    fetchWithSignal.mockResolvedValueOnce(answer(200, { user: TOKENS.user }));
    res = await POST(post({ email: 'ravi@mill.in', password: 'pw' }));
    expect(res.status).toBe(502);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('GET hands the form a CSRF token and sets its cookie', async () => {
    const res = await GET(new NextRequest(new URL('https://alerts.floorbeat.in/api/auth/app-login')));
    const body = await res.json();
    expect(body.csrf).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers.get('set-cookie')).toContain(`esp_csrf=${body.csrf}`);
  });
});
