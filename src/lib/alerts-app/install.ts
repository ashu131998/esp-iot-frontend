/**
 * Which phone this is, whether the app is already on its Home Screen, and who may use the app
 * here. Pure functions of the user agent, the display mode and the referrer; the browser calls are
 * in access-client.ts.
 *
 * Who may use it (the user, 2026-11-21: "only for iphone pwa, and it is necessary to install pwa
 * on iphone to access this, this link should not work on chrome on iphone or android, only safari
 * for iphone ... as we already have apk for android"):
 *  - an iPhone or an iPad: only the app opened from the Home Screen. Safari shows how to add it;
 *    any other browser (Chrome, Firefox, an app's own browser) is told to open the page in Safari;
 *  - an Android phone: only inside the FloorBeat Alerts app (the APK). A browser tab is sent to
 *    the download;
 *  - a computer: the app is for phones.
 */

export type Platform = 'ios' | 'android' | 'other';

/** The Android app's package (the APK, android/twa-manifest.json). */
export const ANDROID_APP_ID = 'in.floorbeat.alerts';
/** Where the Android app is downloaded (marketing/public/downloads), and the page that explains it. */
export const ANDROID_APK_URL = 'https://floorbeat.in/downloads/floorbeat-alerts.apk';
export const APP_PAGE_URL = 'https://floorbeat.in/app';

export function isIOS(userAgent: string | null | undefined): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent ?? '');
}

export function isAndroid(userAgent: string | null | undefined): boolean {
  return /Android/i.test(userAgent ?? '');
}

/** An iPhone, an iPod, or an iPad, whose Safari says it is a Mac (a Mac has no touch screen). */
export function isAppleMobile(userAgent: string | null | undefined, maxTouchPoints?: number | null): boolean {
  return isIOS(userAgent) || (/Macintosh/i.test(userAgent ?? '') && (maxTouchPoints ?? 0) > 1);
}

/**
 * Safari itself: its "Version/… Safari/" signature, without the marks of the other browsers and
 * the apps' own browsers that borrow it (Chrome CriOS, Firefox FxiOS, Edge EdgiOS, Opera, the
 * Google app GSA, DuckDuckGo, Facebook, Instagram, LinkedIn, Line, Snapchat, Yandex).
 */
export function isSafariBrowser(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? '';
  return /Version\/[\d.]+.*Safari\//.test(ua)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|Ddg\/|FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Snapchat|YaBrowser/i.test(ua);
}

/**
 * Whether the site offers itself as an installable web app (its manifest) here: only to an iPhone
 * or an iPad (the user, 2026-11-21: "only on iphone"). Android has the APK: without the manifest,
 * Chrome on Android cannot install the site as an app (its "Add to Home screen" makes a plain
 * shortcut to a browser tab, which shows the download), and the APK does not need it. Computers get
 * none either. Read on the server from the user agent: an iPad's Safari says it is a Mac, so Safari
 * on a Mac counts (a Mac is still turned away by the page).
 */
export function webAppInstallable(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? '';
  return isIOS(ua) || (/Macintosh/i.test(ua) && isSafariBrowser(ua));
}

/** Safari itself on an iPhone (not Chrome or Firefox for iOS, which say CriOS / FxiOS). */
export function isIOSSafari(userAgent: string | null | undefined): boolean {
  return isIOS(userAgent) && isSafariBrowser(userAgent);
}

export function platformOf(userAgent: string | null | undefined): Platform {
  if (isIOS(userAgent)) return 'ios';
  if (isAndroid(userAgent)) return 'android';
  return 'other';
}

/** Opened from the Home Screen: iOS says so on navigator, every browser through the display mode. */
export function isStandalone(env: { navigatorStandalone?: boolean | null; displayModeStandalone?: boolean | null }): boolean {
  return Boolean(env.navigatorStandalone) || Boolean(env.displayModeStandalone);
}

/**
 * Opened by the Android app: the browser gives the page `android-app://in.floorbeat.alerts/` as its
 * referrer when the app opens it (at launch; a page another app opens names that app instead).
 */
export function fromAndroidApp(referrer: string | null | undefined): boolean {
  // Compared as text: browsers parse an android-app: address with an empty host name.
  const r = (referrer ?? '').trim().toLowerCase();
  const app = `android-app://${ANDROID_APP_ID}`;
  if (!r.startsWith(app)) return false;
  const next = r.charAt(app.length);   // in.floorbeat.alerts itself, not in.floorbeat.alertsx
  return next === '' || next === '/' || next === '?' || next === '#';
}

export type AppAccess =
  | 'open'             // the app itself: from an iPhone's Home Screen, or inside the Android app
  | 'add-to-home'      // Safari on an iPhone: add it to the Home Screen first
  | 'use-safari'       // another browser on an iPhone: open the page in Safari
  | 'get-android-app'  // a browser on Android: download the app
  | 'phone-only';      // a computer

export interface AccessEnv {
  userAgent: string | null | undefined;
  /** navigator.maxTouchPoints (see isAppleMobile). */
  maxTouchPoints?: number | null;
  /** iOS: opened from the Home Screen (navigator.standalone). */
  navigatorStandalone?: boolean | null;
  /** The display mode is an installed app's (standalone, fullscreen or minimal-ui), not a browser tab's. */
  displayModeApp?: boolean | null;
  /** document.referrer (see fromAndroidApp). */
  referrer?: string | null;
  /**
   * The Android app opened a page on this phone before. It names itself only at launch, so a page it
   * opens later (a tapped notification) is known by this (remembered by access-client.ts).
   */
  androidAppSeen?: boolean | null;
}

/** Whether the app opens here, and if not, what to show instead. */
export function appAccess(env: AccessEnv): AppAccess {
  const ua = env.userAgent ?? '';
  // The Android app, whatever its browser's user agent says (a tablet's may say it is a computer).
  if (fromAndroidApp(env.referrer) || env.androidAppSeen) return 'open';
  if (isAppleMobile(ua, env.maxTouchPoints)) {
    if (env.navigatorStandalone || env.displayModeApp) return 'open';
    return isSafariBrowser(ua) ? 'add-to-home' : 'use-safari';
  }
  // An installed app on Android: the APK where its browser reports the display mode, or a copy
  // installed from Chrome's own menu (the same app; not offered, see components/alerts-app/app-gate.tsx).
  if (isAndroid(ua)) return env.displayModeApp ? 'open' : 'get-android-app';
  return 'phone-only';
}
