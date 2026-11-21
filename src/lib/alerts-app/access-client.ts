/**
 * The browser's side of who may use the app here (install.ts appAccess): what this phone says
 * about itself, and remembering that the Android app opened a page on it. Every call is guarded:
 * storage can be off (a private tab), matchMedia missing (an old browser).
 * Tested in lib/__tests__/alerts-app-access.test.ts.
 */
import { appAccess, fromAndroidApp, isAndroid, isAppleMobile, type AppAccess } from './install';

export type Phone = 'iphone' | 'android';

/**
 * The phone the app runs on (an iPad counts as an iPhone; the Android app whatever its browser says),
 * for which phone's settings to point at; null on a computer. On a phone the signed-in app opens
 * only with notifications on (push.ts notificationsStep).
 */
export function phoneHere(): Phone | null {
  if (isAppleMobile(navigator.userAgent, navigator.maxTouchPoints)) return 'iphone';
  if (isAndroid(navigator.userAgent) || fromAndroidApp(document.referrer) || androidAppSeen()) return 'android';
  return null;
}

/**
 * Kept in the browser's storage, which the Android app shares with its browser on the phone: the
 * app names itself only at launch, and a page it opens later (a tapped notification) needs this.
 */
export const ANDROID_APP_SEEN_KEY = 'fb-alerts-android-app';

const APP_DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui'];

function displayModeApp(): boolean {
  try {
    return APP_DISPLAY_MODES.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches ?? false);
  } catch {
    return false;
  }
}

export function androidAppSeen(): boolean {
  try {
    return window.localStorage.getItem(ANDROID_APP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** If the Android app opened this page, remember it on this phone; true when it did. */
export function rememberAndroidApp(): boolean {
  if (!fromAndroidApp(document.referrer)) return false;
  try {
    window.localStorage.setItem(ANDROID_APP_SEEN_KEY, '1');
  } catch {
    // storage is off: the app names itself again at its next launch
  }
  return true;
}

/** Who may use the app in this browser, from what it says about itself. */
export function accessHere(): AppAccess {
  return appAccess({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
    displayModeApp: displayModeApp(),
    referrer: document.referrer,
    androidAppSeen: androidAppSeen(),
  });
}
