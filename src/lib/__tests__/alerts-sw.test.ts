/**
 * The alerts app's service worker (public/alerts-sw.js), run as a worker would run it: a push
 * becomes a notification and tells the open pages; a tap opens the alert (in the open window when
 * there is one); a changed subscription is sent to the server; no network gives the offline page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const code = readFileSync(join(__dirname, '..', '..', '..', 'public', 'alerts-sw.js'), 'utf8');

type Listener = (event: Record<string, unknown>) => unknown;

function boot(windows: Array<Record<string, unknown>> = []) {
  const listeners = new Map<string, Listener>();
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const subscribe = vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://push.example/new', keys: { p256dh: 'p2', auth: 'a2' } }) }));
  const self = {
    addEventListener: (name: string, fn: Listener) => listeners.set(name, fn),
    skipWaiting: vi.fn(async () => {}),
    registration: {
      showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => { shown.push({ title, options }); }),
      pushManager: { subscribe },
    },
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async (url: string) => { opened.push(url); return null; }),
    },
  };
  const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
  // the Cache API, as far as the worker uses it: one store of responses by path
  const stored = new Map<string, Response>();
  const caches = { open: async () => ({ put: async (k: string, r: Response) => { stored.set(k, r); }, match: async (k: string) => stored.get(k)?.clone() ?? undefined }) };
  vm.runInNewContext(code, { self, fetch: fetchMock, Response, Date, JSON, String, Boolean, Number, Promise, Intl, console, caches });
  const fire = async (name: string, event: Record<string, unknown>) => {
    const waits: unknown[] = [];
    await listeners.get(name)!({ ...event, waitUntil: (p: unknown) => waits.push(p), respondWith: (p: unknown) => waits.push(p) });
    return Promise.all(waits);
  };
  return { self, listeners, shown, opened, subscribe, fetchMock, fire };
}

const payload = (data: Record<string, unknown>) => ({ json: () => ({ title: '🔴 Loom 3 is DOWN', body: 'Loom 3 stopped at 10:02', data }), text: () => '' });

describe('a push', () => {
  it('shows one notification per alert, kept on screen when HIGH, and tells the open pages', async () => {
    const page = { postMessage: vi.fn() };
    const { shown, fire } = boot([page]);
    await fire('push', { data: payload({ notification_id: 'ntf-1', severity: 'HIGH', url: '/alerts/ntf-1', factory_id: 'mill' }) });
    expect(shown).toEqual([{
      title: '🔴 Loom 3 is DOWN',
      options: expect.objectContaining({
        body: 'Loom 3 stopped at 10:02', icon: '/alerts-icon-192.png', badge: '/alerts-badge-96.png',
        tag: 'alert:ntf-1', renotify: true, requireInteraction: true, data: { url: '/alerts/ntf-1', notification_id: 'ntf-1' },
      }),
    }]);
    expect(page.postMessage).toHaveBeenCalledWith({ type: 'alert', notification_id: 'ntf-1', url: '/alerts/ntf-1' });
  });

  it('a MEDIUM one may be swiped away; one without an id has no tag', async () => {
    const { shown, fire } = boot();
    await fire('push', { data: payload({ notification_id: 'ntf-2', severity: 'MEDIUM', url: '/alerts/ntf-2' }) });
    await fire('push', { data: payload({}) });
    expect(shown[0].options).toMatchObject({ requireInteraction: false, tag: 'alert:ntf-2' });
    expect(shown[1].options).toMatchObject({ renotify: false, data: { url: '/', notification_id: '' } });
    expect(shown[1].options.tag).toBeUndefined();
  });

  it('plain text, or nothing at all, still shows something', async () => {
    const { shown, fire } = boot();
    await fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'Hello' } });
    await fire('push', { data: null });
    expect(shown[0]).toMatchObject({ title: 'FloorBeat Alerts', options: { body: 'Hello' } });
    expect(shown[1]).toMatchObject({ title: 'FloorBeat Alerts', options: { body: '' } });
  });

  it('a tap can only go to a page of the app, never another site', () => {
    const { self } = boot();
    const { targetUrl } = (self as unknown as { __floorbeatAlerts: { targetUrl: (d: unknown) => string } }).__floorbeatAlerts;
    expect(targetUrl({ url: '/alerts/ntf-1' })).toBe('/alerts/ntf-1');
    expect(targetUrl({ url: '//evil.example/x' })).toBe('/');
    expect(targetUrl({ url: 'https://evil.example/x' })).toBe('/');
    expect(targetUrl({ url: '/\\evil' })).toBe('/');
    expect(targetUrl(undefined)).toBe('/');
  });
});

describe('the person\'s language', () => {
  const facts = { notification_id: 'ntf-1', severity: 'HIGH', url: '/alerts/ntf-1', asks: true, view: { kind: 'machine_down', machine: 'Loom 3', at: '2026-11-17T04:32:00.000Z' } };

  it('a push with the facts rings in English until the page says otherwise', async () => {
    const { shown, fire } = boot();
    await fire('push', { data: payload(facts) });
    expect(shown[0].title).toBe('Loom 3 stopped');
    expect(shown[0].options.body).toBe('Loom 3 stopped at 10:02 am. Why is it down? Tap an answer.');
  });

  it('once the page said Hindi or Gujarati, in that language; the words survive a worker restart', async () => {
    const { shown, fire } = boot();
    await fire('message', { data: { type: 'locale', locale: 'hi' } });
    await fire('push', { data: payload(facts) });
    expect(shown[0].title).toBe('Loom 3 रुक गई');
    expect(shown[0].options.body).toContain('रुक गई।');
    await fire('message', { data: { type: 'locale', locale: 'gu' } });
    await fire('push', { data: payload({ ...facts, view: { kind: 'machine_up', machine: 'Loom 3', at: '2026-11-17T04:32:00.000Z', down_for_min: 72 }, asks: false }) });
    expect(shown[1].title).toBe('Loom 3 ફરી ચાલે છે');
    expect(shown[1].options.body).toContain('1 ક 12 મિ');
  });

  it('a push without the facts, or of a kind it does not know, shows what it was sent', async () => {
    const { shown, fire } = boot();
    await fire('message', { data: { type: 'locale', locale: 'hi' } });
    await fire('push', { data: payload({ notification_id: 'ntf-2', severity: 'LOW', url: '/alerts/ntf-2' }) });
    await fire('push', { data: payload({ notification_id: 'ntf-3', view: { kind: 'later_kind', machine: 'x' } }) });
    expect(shown.map((n) => n.title)).toEqual(['🔴 Loom 3 is DOWN', '🔴 Loom 3 is DOWN']);
  });

  it('shift reminders and what an owner hears', () => {
    const { self } = boot();
    const { wordsFor } = (self as unknown as { __floorbeatAlerts: { wordsFor: (v: unknown, l: string, a: boolean) => { title: string; body: string } | null } }).__floorbeatAlerts;
    expect(wordsFor({ kind: 'shift_reminder', shift: 'Day Shift', start: '2026-11-17T00:30:00.000Z', task: 'Weaving', machines: ['Loom 3'] }, 'en', false)).toEqual({ title: 'Day Shift starts at 6:00 am', body: 'Task: Weaving · Machines: Loom 3' });
    expect(wordsFor({ kind: 'owner_down', machine: 'Loom 3', at: '2026-11-17T04:32:00.000Z', operators: ['Ravi'] }, 'en', false)?.body).toBe('Loom 3 stopped at 10:02 am. Ravi has been asked for the reason in the app.');
    expect(wordsFor({ kind: 'owner_up', machine: 'Loom 3', at: '2026-11-17T04:32:00.000Z', down_for_min: 30 }, 'hi', false)?.title).toBe('Loom 3 फिर चल रही है');
    expect(wordsFor(null, 'en', false)).toBeNull();
  });
});

describe('a tap on the notification', () => {
  const notification = (url: string) => ({ close: vi.fn(), data: { url, notification_id: 'ntf-1' } });

  it('opens the alert in a new window when the app is closed', async () => {
    const { opened, fire } = boot();
    const n = notification('/alerts/ntf-1');
    await fire('notificationclick', { notification: n });
    expect(n.close).toHaveBeenCalled();
    expect(opened).toEqual(['/alerts/ntf-1']);
  });

  it('brings an open window to the alert instead', async () => {
    const page = { navigate: vi.fn(async () => page), focus: vi.fn(async () => page), postMessage: vi.fn() };
    const { opened, fire } = boot([page]);
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(page.navigate).toHaveBeenCalledWith('/alerts/ntf-1');
    expect(page.focus).toHaveBeenCalled();
    expect(opened).toEqual([]);
  });

  it('tells a window it cannot steer where to go', async () => {
    const page = { focus: vi.fn(async () => page), postMessage: vi.fn() };
    const { fire } = boot([page]);
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(page.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/alerts/ntf-1' });
    expect(page.focus).toHaveBeenCalled();
  });
});

describe('the subscription changing', () => {
  it('subscribes again with the same key and tells the server', async () => {
    const { subscribe, fetchMock, fire } = boot();
    const key = new Uint8Array([1, 2, 3]);
    await fire('pushsubscriptionchange', { oldSubscription: { options: { applicationServerKey: key } }, newSubscription: null });
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/me/push/subscriptions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ endpoint: 'https://push.example/new', keys: { p256dh: 'p2', auth: 'a2' } });
  });

  it('does nothing without a key to subscribe with', async () => {
    const { subscribe, fire } = boot();
    await fire('pushsubscriptionchange', { oldSubscription: null, newSubscription: null });
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe('no network', () => {
  it('a page asked for while offline gets the offline page, in three languages', async () => {
    const { fetchMock, fire } = boot();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const [res] = (await fire('fetch', { request: { mode: 'navigate', url: 'https://alerts.floorbeat.in/' } })) as Response[];
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('You are offline');
    expect(html).toContain('आप ऑफ़लाइन हैं');
    expect(html).toContain('તમે ઑફલાઇન છો');
  });

  it('passes other requests through untouched', async () => {
    const { fetchMock, fire } = boot();
    const waits = await fire('fetch', { request: { mode: 'cors', url: 'https://alerts.floorbeat.in/api/v1/me/alerts' } });
    expect(waits).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('installing', () => {
  it('takes over at once', async () => {
    const { self, fire } = boot();
    await fire('install', {});
    await fire('activate', {});
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });
});

describe('a stop nobody answered, on the lock screen', () => {
  it('says how long, and asks when there is a question; in the person\'s language', async () => {
    const { self, shown, fire } = boot();
    const { wordsFor } = (self as unknown as { __floorbeatAlerts: { wordsFor: (v: unknown, l: string, a: boolean) => { title: string; body: string } | null } }).__floorbeatAlerts;
    expect(wordsFor({ kind: 'machine_down_waiting', machine: 'Loom 3', waiting_min: 12 }, 'en', true)).toEqual({
      title: 'Loom 3 is still stopped', body: 'Loom 3 has been stopped for 12 m. Nobody has said why yet. Why is it down? Tap an answer.',
    });
    expect(wordsFor({ kind: 'owner_unanswered', machine: 'Loom 3', waiting_min: 75 }, 'en', false)).toEqual({
      title: 'Loom 3 is still stopped', body: 'Loom 3 has been stopped for 1 h 15 m. Nobody has said why yet.',
    });
    expect(wordsFor({ kind: 'owner_unanswered', machine: 'Loom 3' }, 'en', false)?.body).toBe('Loom 3 is still stopped. Nobody has said why yet.');
    await fire('message', { data: { type: 'locale', locale: 'hi' } });
    await fire('push', { data: payload({ notification_id: 'ntf-9', severity: 'HIGH', url: '/alerts/ntf-9', asks: true, view: { kind: 'machine_down_waiting', machine: 'Loom 3', waiting_min: 12 } }) });
    expect(shown[0].title).toBe('Loom 3 अब भी रुकी है');
    expect(shown[0].options.body).toContain('12 मि से रुकी है');
  });
});
