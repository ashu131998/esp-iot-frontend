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
  vm.runInNewContext(code, { self, fetch: fetchMock, Response, Date, JSON, String, Boolean, Promise, console });
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
