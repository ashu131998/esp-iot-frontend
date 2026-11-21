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

/**
 * On a phone the signed-in app opens only once the phone rings (the user, 2026-11-21: "in iphone
 * also, enabling notification in starting and pwa install is necessary to access the app"; "im
 * hoping alerts.floorbeat.in and apk ui is same": the iPhone app and the Android app alike). What it
 * shows until then (components/alerts-app/notifications-gate.tsx): the tap that turns them on, the
 * way back when the phone blocked them, or a phone too old for them (update it).
 */
export type NotificationsStep = 'app' | 'checking' | 'turn-on' | 'blocked' | 'update';

export function notificationsStep(state: PushState | 'checking'): NotificationsStep {
  switch (state) {
    case 'on':
      return 'app';
    // The server cannot send pushes yet: nothing this phone could do, so the app is not held back.
    case 'server-off':
      return 'app';
    case 'off':
      return 'turn-on';
    case 'blocked':
      return 'blocked';
    // Inside the installed app, no Web Push at all: an iOS older than 16.4, or an old browser under the Android app.
    case 'needs-install':
    case 'unsupported':
      return 'update';
    default:   // still looking ('ok' is on its way to one of the above)
      return 'checking';
  }
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
