/**
 * The FloorBeat app: the dashboard as a phone app at dashboard.floorbeat.in (lib/hosts.ts), one address
 * for every factory. Installed on an iPhone's Home Screen (public/dashboard-app.webmanifest) or as the
 * Android app (android/dashboard). Signed in, the address is the person's own factory (middleware.ts).
 */
import { safeNextPath } from '@/lib/auth-redirect';

export const DASHBOARD_APP_NAME = 'FloorBeat';
/** The Android app's package (android/dashboard) and where it is downloaded. */
export const DASHBOARD_ANDROID_APP_ID = 'in.floorbeat.dashboard';
export const DASHBOARD_APK_URL = 'https://floorbeat.in/downloads/floorbeat-dashboard.apk';

/**
 * Where the app goes once signed in: the page named in ?next= (one of this site's), else the address
 * the sign-in was shown at (it loads afresh, signed in), never a sign-in page of its own; else home.
 */
export function afterDashboardSignIn(next: string | null | undefined, here: string | null | undefined = null): string {
  const usable = (path: string | null | undefined) => {
    const safe = safeNextPath(path);
    return safe && !/^\/(?:(?:login|signup|forgot-password)\/?(?:[?#]|$)|f\/|dashboard-app(?:[/?#]|$))/.test(safe) ? safe : null;
  };
  return usable(next) ?? usable(here) ?? '/';
}
