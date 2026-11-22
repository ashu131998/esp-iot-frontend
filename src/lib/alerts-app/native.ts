/**
 * The FloorBeat Alerts Android app around these pages (the repo's android/, 2.0.0): it shows
 * alerts.floorbeat.in in the phone's own web view and gives the page window.FloorBeatAndroid (to its
 * own origin only), through which the page asks for what only the app can do — the phone's
 * notification permission, the app's Firebase push registration, the phone's settings — and hears what
 * the app saw (a push came). Its user agent ends "FloorBeatAlerts/<version> (Android)". The rules are
 * pure; the calls are tested with a stand-in app (lib/__tests__/alerts-app-native.test.ts). The
 * notification switch (push-client.ts) asks the app instead of the browser here.
 */
export type NativeNotifications = 'on' | 'off' | 'blocked';

/** What the app says about itself and the phone (Bridge.kt "hello"). */
export interface NativeHello {
  version: string;
  notifications: NativeNotifications;
  /** This build of the app has its Firebase project (push can reach it). */
  push: boolean;
  /** The phone maker's family (PhoneMaker.kt): xiaomi, vivo, oppo, realme, oneplus, samsung, huawei, … other. */
  maker: string;
  /** Android runs the app without battery restrictions. */
  unrestricted: boolean;
  /** The maker has an "auto-start" screen the app can open. */
  autostart: boolean;
  android: number;
}

const APP_MARK = /\bFloorBeatAlerts\/(\d[\w.]*)/;

/** The Android app's version, from its user agent; null in a browser. */
export function nativeAppVersion(userAgent: string | null | undefined): string | null {
  return APP_MARK.exec(userAgent ?? '')?.[1] ?? null;
}

/** Kept in the page's storage: the battery set-up was shown on this phone. */
export const BATTERY_DONE_KEY = 'fb-alerts-battery-done';

/**
 * The battery set-up comes once, right after notifications are on: unless Android already runs the
 * app unrestricted and the maker has no auto-start screen of its own (nothing to do then).
 */
export function batteryStepNeeded(hello: NativeHello | null | undefined, done: boolean): boolean {
  if (!hello || done) return false;
  return !hello.unrestricted || hello.autostart;
}

// ── the bridge ───────────────────────────────────────────────────────────────────────────────────

interface Port {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

declare global {
  interface Window {
    FloorBeatAndroid?: Port;
    /** The app's back button asks the page first (MainActivity.back): true when the page handled it. */
    floorbeatBack?: () => boolean;
  }
}

function port(): Port | null {
  return typeof window !== 'undefined' ? window.FloorBeatAndroid ?? null : null;
}

/** Inside the Android app (its bridge, or its user agent when its web view is too old for the bridge). */
export function inNativeApp(): boolean {
  return port() !== null || (typeof navigator !== 'undefined' && nativeAppVersion(navigator.userAgent) !== null);
}

const pending = new Map<number, (result: unknown) => void>();
const listeners = new Set<(event: string, value: string) => void>();
let wired: Port | null = null;
let nextId = 1;

function wire(bridge: Port) {
  if (wired === bridge) return;
  wired = bridge;
  bridge.addEventListener('message', (message) => {
    let data: { id?: number; result?: unknown; event?: string; value?: string };
    try {
      data = JSON.parse(String(message.data));
    } catch {
      return;
    }
    if (typeof data.id === 'number') {
      pending.get(data.id)?.(data.result ?? null);
    } else if (typeof data.event === 'string') {
      for (const listener of listeners) listener(data.event, String(data.value ?? ''));
    }
  });
}

/**
 * Asks the app (Bridge.kt): its answer, or null outside the app or with no answer in `timeoutMs`
 * (0: wait as long as it takes, for a question the person answers).
 */
export function callNative<T>(call: string, args: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T | null> {
  const bridge = port();
  if (!bridge) return Promise.resolve(null);
  wire(bridge);
  const id = nextId++;
  return new Promise<T | null>((resolve) => {
    const timer = timeoutMs > 0 ? setTimeout(() => finish(null), timeoutMs) : null;
    function finish(result: unknown) {
      if (timer) clearTimeout(timer);
      pending.delete(id);
      resolve(result as T | null);
    }
    pending.set(id, finish);
    try {
      bridge.postMessage(JSON.stringify({ id, call, ...args }));
    } catch {
      finish(null);
    }
  });
}

/** What the app tells the page: a push came ("push"), its push registration changed ("installation"), notifications switched ("notifications"). Returns stop(). */
export function onNativeEvent(listener: (event: string, value: string) => void): () => void {
  const bridge = port();
  if (bridge) wire(bridge);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── the back button ──────────────────────────────────────────────────────────────────────────────

const backHandlers: Array<() => void> = [];

/**
 * While held, the app's back button runs `handler` (an open live view closes) instead of leaving the
 * page; the latest hold first. Browser only (an effect). Returns release().
 */
export function holdBack(handler: () => void): () => void {
  backHandlers.push(handler);
  window.floorbeatBack = () => {
    const top = backHandlers[backHandlers.length - 1];
    if (!top) return false;
    top();
    return true;
  };
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}
