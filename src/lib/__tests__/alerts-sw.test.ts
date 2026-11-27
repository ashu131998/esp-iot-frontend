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

function boot(windows: Array<Record<string, unknown>> = [], hostname = 'alerts.floorbeat.in') {
  const listeners = new Map<string, Listener>();
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const subscribe = vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://push.example/new', keys: { p256dh: 'p2', auth: 'a2' } }) }));
  const self = {
    location: { hostname },
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
  // what the worker broadcasts to every page of the app (BroadcastChannel)
  const broadcasts: Array<{ channel: string; message: unknown }> = [];
  class BroadcastChannel {
    constructor(private readonly name: string) {}
    postMessage(message: unknown) { broadcasts.push({ channel: this.name, message }); }
    close() {}
  }
  vm.runInNewContext(code, { self, fetch: fetchMock, Response, Date, JSON, String, Boolean, Number, Promise, Intl, console, caches, BroadcastChannel });
  const fire = async (name: string, event: Record<string, unknown>) => {
    const waits: unknown[] = [];
    await listeners.get(name)!({ ...event, waitUntil: (p: unknown) => waits.push(p), respondWith: (p: unknown) => waits.push(p) });
    return Promise.all(waits);
  };
  return { self, listeners, shown, opened, subscribe, fetchMock, fire, stored, broadcasts };
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

  it('also broadcasts it to every page of the app: a phone may not list the window, or not pass the message on', async () => {
    const { broadcasts, fire } = boot();
    await fire('push', { data: payload({ notification_id: 'ntf-1', url: '/alerts/ntf-1' }) });
    expect(broadcasts).toEqual([{ channel: 'fb-alerts', message: { type: 'alert', notification_id: 'ntf-1', url: '/alerts/ntf-1' } }]);
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

  it('a tap handed over without its data still opens the alert its tag names', () => {
    const { self } = boot();
    const { targetUrl } = (self as unknown as { __floorbeatAlerts: { targetUrl: (d: unknown, tag?: unknown) => string } }).__floorbeatAlerts;
    expect(targetUrl(null, 'alert:ntf-7')).toBe('/alerts/ntf-7');
    expect(targetUrl({}, 'alert:9b2f-41aa')).toBe('/alerts/9b2f-41aa');
    expect(targetUrl({ url: '/' }, 'alert:test-1')).toBe('/');   // the data says, when it is there
    expect(targetUrl(null, 'alert:../x')).toBe('/');
    expect(targetUrl(null, 'other')).toBe('/');
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

  it('inside the FloorBeat app (any address but alerts.*), the alert opens at its address there: /inbox/alerts/<id>', async () => {
    const { opened, fire, stored } = boot([], 'dashboard.floorbeat.in');
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(opened).toEqual(['/inbox/alerts/ntf-1']);
    // the note keeps the alerts app's own path: the page puts it under /inbox itself
    expect(JSON.parse(await stored.get('/__open')!.text())).toMatchObject({ url: '/alerts/ntf-1' });
    const page = { navigate: vi.fn(async () => page), focus: vi.fn(async () => page), postMessage: vi.fn() };
    const open = boot([page], 'dashboard.floorbeat.in');
    await open.fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(page.navigate).toHaveBeenCalledWith('/inbox/alerts/ntf-1');
    const inbox = boot([], 'dashboard.localhost');
    await inbox.fire('notificationclick', { notification: notification('/') });
    expect(inbox.opened).toEqual(['/inbox']);
    // and on alerts.floorbeat.in, at its root as ever
    const plain = boot([], 'alerts.floorbeat.in');
    await plain.fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(plain.opened).toEqual(['/alerts/ntf-1']);
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
    const { broadcasts, fire } = boot([page]);
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(page.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/alerts/ntf-1' });
    expect(broadcasts.map((b) => b.message)).toEqual([{ type: 'open', url: '/alerts/ntf-1' }]);
    expect(page.focus).toHaveBeenCalled();
  });

  it('brings the window forward first, while the tap allows it, then steers it', async () => {
    const order: string[] = [];
    const page = {
      focus: vi.fn(async () => { order.push('focus'); return page; }),
      navigate: vi.fn(async () => { order.push('navigate'); return page; }),
      postMessage: vi.fn(),
    };
    const { fire } = boot([page]);
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(order).toEqual(['focus', 'navigate']);
    expect(page.postMessage).not.toHaveBeenCalled();
  });

  it('a window the phone will not let it steer, or that it may not bring forward, still gets there: told to go itself', async () => {
    const refused = { focus: vi.fn(async () => { throw new Error('not allowed'); }), navigate: vi.fn(async () => { throw new TypeError('not controlled'); }), postMessage: vi.fn() };
    let s = boot([refused]);
    await s.fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(refused.navigate).toHaveBeenCalledWith('/alerts/ntf-1');
    expect(refused.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/alerts/ntf-1' });
    const nowhere = { focus: vi.fn(async () => nowhere), navigate: vi.fn(async () => null), postMessage: vi.fn() };
    s = boot([nowhere]);
    await s.fire('notificationclick', { notification: notification('/alerts/ntf-2') });
    expect(nowhere.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/alerts/ntf-2' });
  });

  it('steers the window in front when there are several', async () => {
    const behind = { focus: vi.fn(async () => behind), navigate: vi.fn(async () => behind), postMessage: vi.fn(), visibilityState: 'hidden' };
    const shown = { focus: vi.fn(async () => shown), navigate: vi.fn(async () => shown), postMessage: vi.fn(), visibilityState: 'visible' };
    const { fire } = boot([behind, shown]);
    await fire('notificationclick', { notification: notification('/alerts/ntf-1') });
    expect(shown.navigate).toHaveBeenCalledWith('/alerts/ntf-1');
    expect(behind.navigate).not.toHaveBeenCalled();
  });

  it('notes the alert before anything else, for an app that opens at its start page (lib/alerts-app/open.ts)', async () => {
    const { stored, opened, fire } = boot();
    const before = Date.now();
    await fire('notificationclick', { notification: { close: vi.fn(), data: null, tag: 'alert:ntf-5' } });
    expect(opened).toEqual(['/alerts/ntf-5']);
    const note = await stored.get('/__open')!.clone().json();
    expect(note.url).toBe('/alerts/ntf-5');
    expect(note.at).toBeGreaterThanOrEqual(before);
  });

  it('no window and none could be opened: the pages are told all the same', async () => {
    const { self, broadcasts, fire } = boot();
    (self.clients.openWindow as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await fire('notificationclick', { notification: notification('/alerts/ntf-3') });
    expect(broadcasts.map((b) => b.message)).toEqual([{ type: 'open', url: '/alerts/ntf-3' }]);
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
