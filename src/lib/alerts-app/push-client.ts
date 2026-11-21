/**
 * Push notifications in the browser: the service worker, the permission, the subscription and the
 * server's copy of it. Browser only; the decisions are in push.ts (tested), the calls in api.ts.
 */
import { alertsApi } from './api';
import { isIOS, isStandalone } from './install';
import { CHANNEL, OPEN_KEY, SETTINGS_CACHE, appPage, elsewhere, openTarget } from './open';
import { pushState, pushSupport, subscriptionBody, urlBase64ToUint8Array, type PushState, type PushSupport } from './push';
import type { PushKey } from './types';

export const SW_PATH = '/alerts-sw.js';

/**
 * The server's push key, kept once known, so a tap on "Turn on notifications" asks the phone at
 * once: an iPhone shows its "Allow" prompt only right after a tap, and a wait for the server in
 * between (a slow factory network) could make it refuse without asking.
 */
let knownKey: PushKey | null = null;

async function serverKey(): Promise<PushKey> {
  if (knownKey) return knownKey;
  const key = await alertsApi.key();
  if (key.enabled && key.public_key) knownKey = key;
  return key;
}

/** Tests: start again without a known key. */
export function forgetServerKey(): void {
  knownKey = null;
}

/** Whether this phone can receive notifications at all (push.ts). */
export function supportHere(): PushSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  return pushSupport({
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    ios: isIOS(navigator.userAgent),
    standalone: standaloneHere(),
  });
}

/** Opened from the Home Screen. */
export function standaloneHere(): boolean {
  if (typeof window === 'undefined') return false;
  return isStandalone({
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? null,
  });
}

/** Registers the service worker (idempotent); null where there is none. */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH);
  } catch {
    return null;
  }
}

async function readyWorker(): Promise<ServiceWorkerRegistration | null> {
  const reg = await registerWorker();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

/** The switch's state now: support, the server's key, the permission and whether this phone is subscribed. */
export async function currentState(): Promise<PushState> {
  const support = supportHere();
  if (support !== 'ok') return support;
  const key = await serverKey().catch(() => ({ enabled: false, public_key: null }));
  const reg = await readyWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return pushState(support, Notification.permission, Boolean(sub), key.enabled);
}

/** Asks for the permission, subscribes this phone and tells the server. The state afterwards. */
export async function turnOn(): Promise<PushState> {
  const support = supportHere();
  if (support !== 'ok') return support;
  const key = await serverKey();
  if (!key.enabled || !key.public_key) return 'server-off';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await readyWorker();
  if (!reg) return 'unsupported';
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key.public_key).buffer as ArrayBuffer,
  });
  const body = subscriptionBody(sub.toJSON());
  if (!body) throw new Error('The browser gave no subscription keys');
  await alertsApi.subscribe(body);
  return 'on';
}

/**
 * This phone is set to ring (allowed and subscribed), from the phone alone: an app that needs it
 * (an iPhone, components/alerts-app/notifications-gate.tsx) opens without waiting for the server.
 */
export async function subscribedHere(): Promise<boolean> {
  try {
    if (supportHere() !== 'ok' || Notification.permission !== 'granted') return false;
    const reg = await readyWorker();
    return Boolean(reg && (await reg.pushManager.getSubscription()));
  } catch {
    return false;
  }
}

/** Unsubscribes this phone and removes the server's copy. */
export async function turnOff(): Promise<void> {
  const reg = await readyWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  await alertsApi.unsubscribe(endpoint).catch(() => null);
}

/**
 * On every open: when the permission is granted and this phone is subscribed, send the server the
 * subscription again (the same endpoint is updated, a changed one replaces it) so a phone that was
 * once set up never silently drops out.
 */
export async function keepSubscriptionFresh(): Promise<void> {
  try {
    if (supportHere() !== 'ok' || Notification.permission !== 'granted') return;
    const reg = await readyWorker();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const body = sub ? subscriptionBody(sub.toJSON()) : null;
    if (body) await alertsApi.subscribe(body);
  } catch {
    // best effort: the settings page shows the real state
  }
}

export interface WorkerMessage {
  /** 'alert': a push came; 'open': go to `url` (a tapped notification the worker could not steer a window to). */
  type: 'alert' | 'open';
  url?: string;
}

/**
 * Runs `onMessage` whenever the service worker reports a push or a tap. It says so two ways (open.ts):
 * a message to each window it finds and a broadcast every page hears, so either may be missing on a
 * phone (both reaching the page only refreshes twice). Returns stop().
 */
export function listenForPushes(onMessage: (message: WorkerMessage) => void): () => void {
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; url?: unknown } | null;
    if (!data || (data.type !== 'alert' && data.type !== 'open')) return;
    onMessage({ type: data.type, url: typeof data.url === 'string' ? data.url : undefined });
  };
  const stops: Array<() => void> = [];
  const container = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  if (container) {
    container.addEventListener('message', handler);
    // Messages wait until the page says it listens; most browsers start them once the page has loaded.
    container.startMessages?.();
    stops.push(() => container.removeEventListener('message', handler));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL);
      channel.addEventListener('message', handler);
      stops.push(() => channel.close());
    } catch {
      // no channels here: the worker's messages alone
    }
  }
  return () => stops.forEach((stop) => stop());
}

/** The note of a tapped notification (open.ts), taken: the page it names, or null; gone afterwards either way. */
export async function takeOpenNote(nowMs = Date.now()): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(SETTINGS_CACHE);
    const hit = await cache.match(OPEN_KEY);
    if (!hit) return null;
    await cache.delete(OPEN_KEY);
    return openTarget(await hit.json().catch(() => null), nowMs);
  } catch {
    return null;
  }
}

/** After a push, the inbox is asked again this much later too: an alert the first ask missed is in by then. */
export const ASK_AGAIN_MS = 4_000;
/** The worker notes a tap a moment after the phone brings the app to the front: looked for again then. */
const LOOK_AGAIN_MS = 1_000;

/**
 * While the app is open: a push refreshes the inbox (`refresh`), and a tapped notification's alert is
 * opened (`go`) unless the app is on it already (`here`): when the worker says so, and from the worker's
 * note when the app starts and whenever it comes to the front. Browser only (an effect). Returns stop().
 */
export function followAlerts({ refresh, go, here }: {
  refresh: () => void;
  go: (url: string) => void;
  here: () => string;
}): () => void {
  let stopped = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };
  const goTo = (url: string | null) => {
    if (!stopped && url && elsewhere(url, here())) go(url);
  };
  const followNote = () => {
    void takeOpenNote().then(goTo);
  };

  const stopListening = listenForPushes((message) => {
    refresh();
    if (message.type === 'alert') later(refresh, ASK_AGAIN_MS);
    if (message.type === 'open') {
      void takeOpenNote();   // this tap's note: followed now, so it never moves the app later
      goTo(appPage(message.url));
    }
  });
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    followNote();
    later(followNote, LOOK_AGAIN_MS);
  };
  followNote();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    stopListening();
    document.removeEventListener('visibilitychange', onVisible);
    timers.forEach(clearTimeout);
    timers.clear();
  };
}

/** Tells the service worker the person's language (it keeps it for the pushes it shows). */
export async function tellWorkerLocale(locale: string): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'locale', locale });
  } catch {
    // no worker here
  }
}

/** The number on the app's icon (Android, desktop): the unread count; nothing when it is 0. */
export function setBadge(unread: number): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (unread > 0) void nav.setAppBadge?.(unread);
    else void nav.clearAppBadge?.();
  } catch {
    // not supported here
  }
}
