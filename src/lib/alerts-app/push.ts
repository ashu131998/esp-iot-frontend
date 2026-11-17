/**
 * Push notifications, the pure part: whether this phone can receive them, what state the switch
 * is in, and the subscription as the server wants it. The browser calls are in push-client.ts.
 *
 * iPhones only deliver Web Push to an app added to the Home Screen (iOS 16.4 and later), so Safari
 * itself gets "install first". Android Chrome and desktop browsers work as they are.
 */

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';

export interface PushEnvironment {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  ios: boolean;
  /** Opened from the Home Screen (standalone), not inside the browser. */
  standalone: boolean;
}

/** Whether notifications can work here at all, and if not, why. */
export function pushSupport(env: PushEnvironment): PushSupport {
  if (env.ios && !env.standalone) return 'needs-install';
  if (!env.serviceWorker || !env.pushManager || !env.notification) return env.ios ? 'needs-install' : 'unsupported';
  return 'ok';
}

export type PushState = PushSupport | 'server-off' | 'blocked' | 'off' | 'on';

/** The switch's state from what the browser and the server say. */
export function pushState(
  support: PushSupport,
  permission: 'default' | 'granted' | 'denied' | null,
  subscribed: boolean,
  serverEnabled: boolean,
): PushState {
  if (support !== 'ok') return support;
  if (!serverEnabled) return 'server-off';
  if (permission === 'denied') return 'blocked';
  if (permission === 'granted' && subscribed) return 'on';
  return 'off';
}

/** A VAPID public key (base64url) as the bytes pushManager.subscribe takes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The subscription as POST /v1/me/push/subscriptions takes it; null when the browser gave no keys. */
export function subscriptionBody(json: { endpoint?: string | null; keys?: Record<string, string> | null } | null | undefined): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  const endpoint = json?.endpoint ?? '';
  const p256dh = json?.keys?.p256dh ?? '';
  const auth = json?.keys?.auth ?? '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}
