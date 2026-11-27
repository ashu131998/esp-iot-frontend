/**
 * The FloorBeat app: ONE app (the owner, 2026-11-27: "when user open that app, i want to show three apps inside
 * it: alerts, dashboard, IMS", "it is like making ps5 homescreen"), at dashboard.floorbeat.in (lib/hosts.ts),
 * one address for every factory. Installed on an iPhone's Home Screen (public/dashboard-app.webmanifest) or as
 * the Android app (android/app, which was FloorBeat Alerts: an update of it, so its alerts never stop).
 *
 * It opens on its home screen, its root (/), in the phone app, the iPhone's Home Screen app and a computer's
 * browser alike (the owner: "same in pwa and desktop"): a tile for each of the person's apps, each saying something
 * live. Signed in, the address is the person's own factory (middleware.ts): /overview the dashboard (its other pages
 * at their plain addresses, /energy…), /inbox their alerts (the alerts app's screens), /ims the stock (FloorBeat IMS).
 */
import { isShown, pageOn, type Display } from '@/lib/display';
import { safeNextPath } from '@/lib/auth-redirect';

export const DASHBOARD_APP_NAME = 'FloorBeat';
/** The Android app's package (android/app: the alerts app's package, which has the phone's push) and where it is downloaded. */
export const DASHBOARD_ANDROID_APP_ID = 'in.floorbeat.alerts';
export const DASHBOARD_APK_URL = 'https://floorbeat.in/downloads/floorbeat.apk';

/** The app's home screen, where it opens: its root. */
export const APP_HOME = '/';
/** The dashboard's overview inside the app (a factory's own address has it at its root). */
export const APP_OVERVIEW = '/overview';
/** Where the alerts' screens are inside the app (on alerts.floorbeat.in they are at its root). */
export const INBOX_BASE = '/inbox';

/** The apps inside the app, in the order the home screen shows them. */
export type AppTile = 'alerts' | 'dashboard' | 'stock';

/** Where each tile opens. */
export const TILE_HREF: Record<AppTile, string> = { alerts: INBOX_BASE, dashboard: APP_OVERVIEW, stock: '/ims/stock' };

/**
 * The tiles a person's home screen has: the alerts unless our staff switched the Alerts app off for the factory,
 * the dashboard always, the stock where the IMS is on (display.js 'alerts_app' and 'ims', set on ops).
 */
export function appTiles(display: Display | null | undefined): AppTile[] {
  const tiles: AppTile[] = [];
  if (isShown(display, 'alerts_app')) tiles.push('alerts');
  tiles.push('dashboard');
  if (pageOn(display, 'ims')) tiles.push('stock');
  return tiles;
}

/** Where /home goes: nowhere (it shows the tiles) with two or more, straight to the one app with one. */
export function homeTarget(tiles: readonly AppTile[]): string | null {
  return tiles.length === 1 ? TILE_HREF[tiles[0]] : null;
}

/** An alert's page (as the alerts app names it: /, /alerts/<id>, /settings) at its address inside the app. */
export function inboxHref(path: string): string {
  return path === '/' || path === '' ? INBOX_BASE : `${INBOX_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Where the app goes once signed in: the page named in ?next= (one of this site's), else the address
 * the sign-in was shown at (it loads afresh, signed in), never a sign-in page of its own; else its home screen.
 */
export function afterDashboardSignIn(next: string | null | undefined, here: string | null | undefined = null): string {
  const usable = (path: string | null | undefined) => {
    const safe = safeNextPath(path);
    return safe && !/^\/(?:(?:login|signup|forgot-password)\/?(?:[?#]|$)|f\/|dashboard-app(?:[/?#]|$))/.test(safe) ? safe : null;
  };
  return usable(next) ?? usable(here) ?? APP_HOME;
}
