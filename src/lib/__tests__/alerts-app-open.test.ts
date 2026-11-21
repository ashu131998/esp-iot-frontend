/**
 * The open app and its service worker (lib/alerts-app/open.ts, push-client.ts followAlerts), with a
 * stand-in phone: a push refreshes the inbox at once and again a few seconds later; a tapped
 * notification lands on its alert whichever way the phone passes the tap on (the worker's message, its
 * broadcast, or only its note, read when the app starts or comes to the front); and the app is never
 * moved when it is on the alert already, nor by an old note.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts-app/api', () => ({ alertsApi: {} }));

const { CHANNEL, OPEN_FRESH_MS, OPEN_KEY, appPage, elsewhere, openTarget } = await import('@/lib/alerts-app/open');
const { ASK_AGAIN_MS, followAlerts, listenForPushes, takeOpenNote } = await import('@/lib/alerts-app/push-client');

describe('the rules', () => {
  const NOW = 1_800_000_000_000;

  it('a note sends the app to a page of its own while it is fresh', () => {
    expect(openTarget({ url: '/alerts/ntf-1', at: NOW - 5_000 }, NOW)).toBe('/alerts/ntf-1');
    expect(openTarget({ url: '/alerts/ntf-1', at: NOW - OPEN_FRESH_MS - 1 }, NOW)).toBeNull();
    expect(openTarget({ url: '/alerts/ntf-1', at: NOW + OPEN_FRESH_MS + 1 }, NOW)).toBeNull();
    for (const bad of [null, 'x', { url: '/a' }, { url: '/a', at: 'now' }, { url: 'https://evil.example/', at: NOW }, { url: '//evil.example', at: NOW }]) {
      expect(openTarget(bad, NOW)).toBeNull();
    }
  });

  it('a page of the app is a path on this site', () => {
    expect(appPage('/alerts/ntf-1?x=1')).toBe('/alerts/ntf-1?x=1');
    for (const bad of ['https://evil.example/', '//evil.example', '/\\evil', '/a\nb', 42, undefined]) expect(appPage(bad)).toBeNull();
  });

  it('the app moves only when it is elsewhere', () => {
    expect(elsewhere('/alerts/ntf-1', '/')).toBe(true);
    expect(elsewhere('/alerts/ntf-1', '/alerts/ntf-1')).toBe(false);
    expect(elsewhere('/alerts/ntf-1', '/alerts/ntf-1/')).toBe(false);
    expect(elsewhere('/', '/')).toBe(false);
    expect(elsewhere('/alerts/ntf-1?x=1', '/alerts/ntf-1')).toBe(true);
    expect(elsewhere('/?x=1', '//?x=1')).toBe(false);
  });
});

/** A phone with the app open: its worker's messages, the app's channel, its Cache API, whether it is in front. */
function phone({ startMessages = true, channels = true } = {}) {
  const workerListeners = new Set<(event: MessageEvent) => void>();
  const container = {
    addEventListener: vi.fn((_: string, fn: (event: MessageEvent) => void) => workerListeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: (event: MessageEvent) => void) => workerListeners.delete(fn)),
    ...(startMessages ? { startMessages: vi.fn() } : {}),
  };
  const channelListeners = new Set<(event: MessageEvent) => void>();
  const opened: string[] = [];
  class FakeChannel {
    constructor(name: string) { opened.push(name); }
    addEventListener(_: string, fn: (event: MessageEvent) => void) { channelListeners.add(fn); }
    close() { channelListeners.clear(); }
  }
  const store = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => store.get(key)?.clone()),
    delete: vi.fn(async (key: string) => store.delete(key)),
  };
  const docListeners = new Set<() => void>();
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: vi.fn((_: string, fn: () => void) => docListeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: () => void) => docListeners.delete(fn)),
  };
  vi.stubGlobal('navigator', { serviceWorker: container });
  if (channels) vi.stubGlobal('BroadcastChannel', FakeChannel);
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  vi.stubGlobal('document', doc);
  return {
    container, opened, store, doc,
    note: (url: string, at = Date.now()) => store.set(OPEN_KEY, new Response(JSON.stringify({ url, at }))),
    fromWorker: (data: unknown) => workerListeners.forEach((fn) => fn({ data } as MessageEvent)),
    broadcast: (data: unknown) => channelListeners.forEach((fn) => fn({ data } as MessageEvent)),
    toFront: () => { doc.visibilityState = 'visible'; docListeners.forEach((fn) => fn()); },
    toBack: () => { doc.visibilityState = 'hidden'; docListeners.forEach((fn) => fn()); },
    listening: () => workerListeners.size + channelListeners.size + docListeners.size,
  };
}

const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hearing the worker', () => {
  it('both ways: its message and its broadcast on the app\'s channel; messages started; nothing else heard', () => {
    const p = phone();
    const heard: unknown[] = [];
    const stop = listenForPushes((m) => heard.push(m));
    expect(p.container.startMessages).toHaveBeenCalled();
    expect(p.opened).toEqual([CHANNEL]);
    p.fromWorker({ type: 'alert', notification_id: 'ntf-1', url: '/alerts/ntf-1' });
    p.broadcast({ type: 'open', url: '/alerts/ntf-2' });
    p.fromWorker({ type: 'locale', locale: 'hi' });
    p.broadcast(null);
    expect(heard).toEqual([{ type: 'alert', url: '/alerts/ntf-1' }, { type: 'open', url: '/alerts/ntf-2' }]);
    stop();
    expect(p.listening()).toBe(0);
  });

  it('a phone without channels or startMessages: the worker\'s messages alone', () => {
    const p = phone({ startMessages: false, channels: false });
    vi.stubGlobal('BroadcastChannel', undefined);
    const heard: unknown[] = [];
    const stop = listenForPushes((m) => heard.push(m));
    p.fromWorker({ type: 'alert' });
    expect(heard).toEqual([{ type: 'alert', url: undefined }]);
    stop();
  });

  it('a browser without a service worker: the broadcast alone; one whose channel cannot open: nothing, and no error', () => {
    const p = phone();
    vi.stubGlobal('navigator', {});
    const heard: unknown[] = [];
    let stop = listenForPushes((m) => heard.push(m));
    p.broadcast({ type: 'alert' });
    expect(heard).toEqual([{ type: 'alert', url: undefined }]);
    stop();
    vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('blocked'); } });
    stop = listenForPushes((m) => heard.push(m));
    stop();
  });
});

describe('the note of a tap', () => {
  it('taken once: the page it names, then gone; an old note is dropped', async () => {
    const p = phone();
    p.note('/alerts/ntf-1');
    expect(await takeOpenNote()).toBe('/alerts/ntf-1');
    expect(await takeOpenNote()).toBeNull();
    p.note('/alerts/ntf-1', Date.now() - OPEN_FRESH_MS - 1);
    expect(await takeOpenNote()).toBeNull();
    expect(p.store.size).toBe(0);
  });

  it('a phone without the Cache API, one that refuses it, or a broken note: nothing', async () => {
    const p = phone();
    p.store.set(OPEN_KEY, new Response('not json'));
    expect(await takeOpenNote()).toBeNull();
    vi.stubGlobal('caches', { open: async () => { throw new Error('storage blocked'); } });
    expect(await takeOpenNote()).toBeNull();
    vi.stubGlobal('caches', undefined);
    expect(await takeOpenNote()).toBeNull();
  });
});

describe('while the app is open', () => {
  function app(start = '/') {
    let here = start;
    const go = vi.fn((url: string) => { here = url; });
    const refresh = vi.fn();
    return { go, refresh, here: () => here, at: (url: string) => { here = url; } };
  }

  it('a push refreshes the inbox at once, and again a few seconds later (an alert the first ask missed)', async () => {
    const p = phone();
    const a = app();
    followAlerts(a);
    p.fromWorker({ type: 'alert', notification_id: 'ntf-1' });
    p.broadcast({ type: 'alert', notification_id: 'ntf-1' });
    expect(a.refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(ASK_AGAIN_MS);
    expect(a.refresh).toHaveBeenCalledTimes(4);
    expect(a.go).not.toHaveBeenCalled();
  });

  it('a tap the worker could not steer: the app goes to the alert itself, once, and its note is used up', async () => {
    const p = phone();
    const a = app();
    followAlerts(a);
    await settle();
    p.note('/alerts/ntf-1');
    p.fromWorker({ type: 'open', url: '/alerts/ntf-1' });
    p.broadcast({ type: 'open', url: '/alerts/ntf-1' });
    await settle();
    expect(a.go).toHaveBeenCalledTimes(1);
    expect(a.go).toHaveBeenCalledWith('/alerts/ntf-1');
    expect(p.store.size).toBe(0);
    p.fromWorker({ type: 'open', url: 'https://evil.example/' });
    expect(a.go).toHaveBeenCalledTimes(1);
  });

  it('the phone opened the app at its start page: the note takes it to the alert', async () => {
    const p = phone();
    p.note('/alerts/ntf-9');
    const a = app('/');
    followAlerts(a);
    await settle();
    expect(a.go).toHaveBeenCalledWith('/alerts/ntf-9');
  });

  it('opened on the alert already (the worker steered it): the note is used up, the app stays', async () => {
    const p = phone();
    p.note('/alerts/ntf-9');
    const a = app('/alerts/ntf-9');
    followAlerts(a);
    await settle();
    expect(a.go).not.toHaveBeenCalled();
    expect(p.store.size).toBe(0);
  });

  it('brought to the front by a tap: the note is read then, and once more a moment later (the worker writes it just after)', async () => {
    const p = phone();
    const a = app('/settings');
    followAlerts(a);
    await settle();
    p.toBack();
    p.toFront();
    await settle();
    expect(a.go).not.toHaveBeenCalled();
    p.note('/alerts/ntf-4');
    await vi.advanceTimersByTimeAsync(1_000);
    await settle();
    expect(a.go).toHaveBeenCalledWith('/alerts/ntf-4');
  });

  it('stopped: nothing heard, nothing read, no refresh left to come', async () => {
    const p = phone();
    const a = app();
    const stop = followAlerts(a);
    p.fromWorker({ type: 'alert' });
    stop();
    expect(p.listening()).toBe(0);
    await vi.advanceTimersByTimeAsync(ASK_AGAIN_MS);
    expect(a.refresh).toHaveBeenCalledTimes(1);
  });
});
