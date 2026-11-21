/**
 * Who may use FloorBeat Alerts where (lib/alerts-app/install.ts appAccess, the browser's side in
 * access-client.ts). The user, 2026-11-21: only the iPhone app from the Home Screen (installed from
 * Safari) and the Android APK; not Chrome on an iPhone or on Android, not a computer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANDROID_APP_SEEN_KEY, accessHere, androidAppSeen, phoneHere, rememberAndroidApp } from '@/lib/alerts-app/access-client';
import { appAccess, fromAndroidApp, isAppleMobile, isSafariBrowser, type AccessEnv } from '@/lib/alerts-app/install';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_HOME_SCREEN = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_EDGE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/125.0.2535.60 Mobile/15E148 Safari/605.1.15';
const IPHONE_GOOGLE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/317.0.634488990 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.3.12.235 (iPhone14,5; iOS 17_5; en_IN)';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';   // an iPad's Safari says this too
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const DESKTOP_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';   // also an Android tablet's "desktop site"
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const APP_REFERRER = 'android-app://in.floorbeat.alerts/';

const access = (userAgent: string, rest: Omit<AccessEnv, 'userAgent'> = {}) => appAccess({ userAgent, ...rest });

describe('an iPhone', () => {
  it('opens the app from the Home Screen, however iOS says so', () => {
    expect(access(IPHONE_HOME_SCREEN, { navigatorStandalone: true })).toBe('open');
    expect(access(IPHONE_SAFARI, { displayModeApp: true })).toBe('open');
    expect(access(IPHONE_CHROME, { navigatorStandalone: true })).toBe('open');   // added from Chrome's share menu: the same Home Screen app
  });

  it('Safari, not installed: the steps to add it to the Home Screen', () => {
    expect(access(IPHONE_SAFARI)).toBe('add-to-home');
    expect(access(IPHONE_SAFARI, { navigatorStandalone: false, displayModeApp: false })).toBe('add-to-home');
  });

  it('any other browser, or an app\'s own browser: open the page in Safari', () => {
    for (const ua of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_EDGE, IPHONE_GOOGLE_APP, IPHONE_INSTAGRAM]) {
      expect(access(ua), ua).toBe('use-safari');
    }
  });

  it('an iPad, whose Safari says it is a Mac: the same as an iPhone; a real Mac is a computer', () => {
    expect(access(MAC_SAFARI, { maxTouchPoints: 5 })).toBe('add-to-home');
    expect(access(MAC_SAFARI, { maxTouchPoints: 5, navigatorStandalone: true })).toBe('open');
    expect(access(MAC_SAFARI, { maxTouchPoints: 0 })).toBe('phone-only');
    expect(access(MAC_SAFARI, { maxTouchPoints: 0, displayModeApp: true })).toBe('phone-only');   // a Mac's "Add to Dock"
  });
});

describe('an Android phone', () => {
  it('opens the app inside the APK: it names itself as the referrer at launch', () => {
    expect(access(ANDROID_CHROME, { referrer: APP_REFERRER })).toBe('open');
  });

  it('a page the APK opens later without naming itself (a tapped notification): known from before', () => {
    expect(access(ANDROID_CHROME, { referrer: '', androidAppSeen: true })).toBe('open');
  });

  it('where the APK\'s browser reports an installed display mode, that is enough too', () => {
    expect(access(ANDROID_CHROME, { displayModeApp: true })).toBe('open');
  });

  it('a Chrome tab: the download, even from a link another app opened', () => {
    expect(access(ANDROID_CHROME)).toBe('get-android-app');
    expect(access(ANDROID_CHROME, { referrer: 'android-app://com.whatsapp/' })).toBe('get-android-app');
    expect(access(ANDROID_CHROME, { referrer: 'https://floorbeat.in/app' })).toBe('get-android-app');
  });

  it('a tablet whose browser says it is a computer: still the app inside the APK', () => {
    expect(access(DESKTOP_LINUX, { referrer: APP_REFERRER })).toBe('open');
    expect(access(DESKTOP_LINUX, { androidAppSeen: true })).toBe('open');
  });
});

describe('a computer', () => {
  it('is told the app is for phones, installed or not', () => {
    expect(access(WINDOWS_CHROME)).toBe('phone-only');
    expect(access(WINDOWS_CHROME, { displayModeApp: true })).toBe('phone-only');
    expect(access(DESKTOP_LINUX)).toBe('phone-only');
    expect(access('')).toBe('phone-only');
    expect(appAccess({ userAgent: null })).toBe('phone-only');
  });
});

describe('the words in a browser\'s signature', () => {
  it('the Android app\'s own referrer, and no other app\'s', () => {
    expect(fromAndroidApp('android-app://in.floorbeat.alerts')).toBe(true);
    expect(fromAndroidApp('android-app://in.floorbeat.alerts/')).toBe(true);
    expect(fromAndroidApp(' Android-App://IN.FLOORBEAT.ALERTS/ ')).toBe(true);
    expect(fromAndroidApp('android-app://in.floorbeat.alerts?x=1')).toBe(true);
    expect(fromAndroidApp('android-app://in.floorbeat.alertsx/')).toBe(false);
    expect(fromAndroidApp('android-app://com.whatsapp/')).toBe(false);
    expect(fromAndroidApp('https://alerts.floorbeat.in/')).toBe(false);
    expect(fromAndroidApp('')).toBe(false);
    expect(fromAndroidApp(null)).toBe(false);
  });

  it('Safari itself, on any Apple device', () => {
    expect(isSafariBrowser(IPHONE_SAFARI)).toBe(true);
    expect(isSafariBrowser(MAC_SAFARI)).toBe(true);
    for (const ua of [IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_EDGE, IPHONE_GOOGLE_APP, IPHONE_INSTAGRAM, IPHONE_HOME_SCREEN, ANDROID_CHROME, WINDOWS_CHROME]) {
      expect(isSafariBrowser(ua), ua).toBe(false);
    }
    expect(isSafariBrowser(null)).toBe(false);
  });

  it('an Apple phone or tablet', () => {
    expect(isAppleMobile(IPHONE_SAFARI)).toBe(true);
    expect(isAppleMobile(MAC_SAFARI, 5)).toBe(true);
    expect(isAppleMobile(MAC_SAFARI, 0)).toBe(false);
    expect(isAppleMobile(MAC_SAFARI)).toBe(false);
    expect(isAppleMobile(ANDROID_CHROME, 5)).toBe(false);
  });
});

describe('what the browser says, read on the phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A browser: its signature, the page's referrer, the display modes it matches, and its storage. */
  function browser({ ua, referrer = '', standalone, modes = [], touch = 0, storage = new Map<string, string>(), storageOff = false, noMatchMedia = false, matchMediaThrows = false }: {
    ua: string; referrer?: string; standalone?: boolean; modes?: string[]; touch?: number;
    storage?: Map<string, string>; storageOff?: boolean; noMatchMedia?: boolean; matchMediaThrows?: boolean;
  }) {
    const off = () => { throw new Error('storage is off'); };
    vi.stubGlobal('navigator', { userAgent: ua, maxTouchPoints: touch, ...(standalone === undefined ? {} : { standalone }) });
    vi.stubGlobal('document', { referrer });
    vi.stubGlobal('window', {
      localStorage: storageOff ? { getItem: off, setItem: off } : { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) },
      ...(noMatchMedia ? {} : {
        matchMedia: (query: string) => {
          if (matchMediaThrows) throw new Error('not supported');
          return { matches: modes.some((m) => query === `(display-mode: ${m})`) };
        },
      }),
    });
    return storage;
  }

  it('which phone (its settings are pointed at; a phone needs notifications on): an iPad is an iPhone, the Android app whatever its browser says', () => {
    browser({ ua: IPHONE_SAFARI });
    expect(phoneHere()).toBe('iphone');
    browser({ ua: MAC_SAFARI, touch: 5 });
    expect(phoneHere()).toBe('iphone');
    browser({ ua: ANDROID_CHROME, touch: 5 });
    expect(phoneHere()).toBe('android');
    browser({ ua: DESKTOP_LINUX, referrer: APP_REFERRER });
    expect(phoneHere()).toBe('android');
    browser({ ua: DESKTOP_LINUX, storage: new Map([[ANDROID_APP_SEEN_KEY, '1']]) });
    expect(phoneHere()).toBe('android');
    browser({ ua: MAC_SAFARI });
    expect(phoneHere()).toBeNull();
    browser({ ua: WINDOWS_CHROME });
    expect(phoneHere()).toBeNull();
  });

  it('the APK at launch: opens, and is remembered for the pages it opens later', () => {
    const storage = browser({ ua: ANDROID_CHROME, referrer: APP_REFERRER });
    expect(accessHere()).toBe('open');
    expect(rememberAndroidApp()).toBe(true);
    expect(storage.get(ANDROID_APP_SEEN_KEY)).toBe('1');
    browser({ ua: ANDROID_CHROME, referrer: '', storage });   // a tapped notification, the same phone
    expect(androidAppSeen()).toBe(true);
    expect(accessHere()).toBe('open');
  });

  it('a Chrome tab on a phone where the APK never ran: the download, and nothing remembered', () => {
    const storage = browser({ ua: ANDROID_CHROME });
    expect(accessHere()).toBe('get-android-app');
    expect(rememberAndroidApp()).toBe(false);
    expect(storage.size).toBe(0);
  });

  it('an iPhone: from the Home Screen (navigator.standalone) or Safari', () => {
    browser({ ua: IPHONE_HOME_SCREEN, standalone: true });
    expect(accessHere()).toBe('open');
    browser({ ua: IPHONE_SAFARI, standalone: false });
    expect(accessHere()).toBe('add-to-home');
    browser({ ua: MAC_SAFARI, touch: 5, modes: ['standalone'] });   // an iPad's Home Screen app
    expect(accessHere()).toBe('open');
  });

  it('every installed display mode counts: standalone, fullscreen, minimal-ui', () => {
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
      browser({ ua: ANDROID_CHROME, modes: [mode] });
      expect(accessHere(), mode).toBe('open');
    }
    browser({ ua: ANDROID_CHROME, modes: ['browser'] });
    expect(accessHere()).toBe('get-android-app');
  });

  it('storage off or no display modes (a private tab, an old browser): nothing breaks', () => {
    browser({ ua: ANDROID_CHROME, referrer: APP_REFERRER, storageOff: true });
    expect(accessHere()).toBe('open');
    expect(rememberAndroidApp()).toBe(true);   // could not be kept; the app names itself again at its next launch
    expect(androidAppSeen()).toBe(false);
    browser({ ua: ANDROID_CHROME, noMatchMedia: true });
    expect(accessHere()).toBe('get-android-app');
    browser({ ua: ANDROID_CHROME, matchMediaThrows: true });
    expect(accessHere()).toBe('get-android-app');
  });
});
