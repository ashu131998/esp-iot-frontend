/**
 * Where a tapped notification takes the app, and how the open app hears of a push. The service
 * worker (public/alerts-sw.js, which keeps the same names) writes a note of the alert it is opening
 * before it steers a window there, and tells the open pages two ways: a message to each window it
 * finds, and a broadcast on CHANNEL that every page of the app hears. The app reads the note when
 * it starts, when it comes to the front and when the worker says so, and goes to the alert unless
 * it is there already: a phone that opens the app at its start page, or will not let the worker
 * steer a window, still lands on the alert (the user, 2026-11-21: a tapped camera alert showed the
 * inbox). Pure: tested in lib/__tests__/alerts-app-open.test.ts.
 */

/** The worker's store in the Cache API (also the person's language) and the note's key in it. */
export const SETTINGS_CACHE = 'fb-alerts-settings';
export const OPEN_KEY = '/__open';
/** The BroadcastChannel the worker tells every page of the app on. */
export const CHANNEL = 'fb-alerts';
/** A note older than this is not followed: the tap was long ago. */
export const OPEN_FRESH_MS = 2 * 60_000;

export interface OpenNote {
  url: string;
  /** When the notification was tapped (ms since 1970). */
  at: number;
}

/** A page of the app (a path on this site), never another site; null otherwise. */
export function appPage(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  if (!/^\/(?![/\\])/.test(url) || /[\u0000-\u001f\\]/.test(url)) return null;
  return url;
}

/** The page a note sends the app to; null when there is no note, it is old, or it names no page of the app. */
export function openTarget(note: unknown, nowMs: number): string | null {
  if (!note || typeof note !== 'object') return null;
  const { url, at } = note as Partial<OpenNote>;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (nowMs - at > OPEN_FRESH_MS || at - nowMs > OPEN_FRESH_MS) return null;   // long ago, or a clock far off
  return appPage(url);
}

/** Whether going to `target` moves the app: not when it is on that page already ("/alerts/a/" is "/alerts/a"). */
export function elsewhere(target: string, here: string): boolean {
  const plain = (p: string) => {
    const cut = p.search(/[?#]/);
    const path = cut < 0 ? p : p.slice(0, cut);
    return `${path.replace(/\/+$/, '') || '/'}${cut < 0 ? '' : p.slice(cut)}`;
  };
  return plain(target) !== plain(here);
}
