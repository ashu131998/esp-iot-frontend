/**
 * Push notifications in the browser: the service worker, the permission, the subscription and the
 * server's copy of it. Browser only; the decisions are in push.ts (tested), the calls in api.ts.
 */
import { alertsApi } from './api';
import { isIOS, isStandalone } from './install';
import { pushState, pushSupport, subscriptionBody, urlBase64ToUint8Array, type PushState, type PushSupport } from './push';

export const SW_PATH = '/alerts-sw.js';

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
  const key = await alertsApi.key().catch(() => ({ enabled: false, public_key: null }));
  const reg = await readyWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return pushState(support, Notification.permission, Boolean(sub), key.enabled);
}

/** Asks for the permission, subscribes this phone and tells the server. The state afterwards. */
export async function turnOn(): Promise<PushState> {
  const support = supportHere();
  if (support !== 'ok') return support;
  const key = await alertsApi.key();
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

/** Runs `onAlert` whenever the service worker reports a push (the page refreshes its inbox). Returns stop(). */
export function listenForPushes(onAlert: (message: { type: string; url?: string }) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | null;
    if (data && (data.type === 'alert' || data.type === 'open')) onAlert({ type: data.type, url: data.url });
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
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
