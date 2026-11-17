/**
 * Which phone this is and whether the app is already on its Home Screen: the install page shows
 * the steps for that phone, and the notifications switch knows an iPhone must install first.
 * Pure functions of the user agent and the display mode.
 */

export type Platform = 'ios' | 'android' | 'other';

export function isIOS(userAgent: string | null | undefined): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent ?? '');
}

export function isAndroid(userAgent: string | null | undefined): boolean {
  return /Android/i.test(userAgent ?? '');
}

/** Safari itself on an iPhone (not Chrome or Firefox for iOS, which say CriOS / FxiOS). */
export function isIOSSafari(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? '';
  return isIOS(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
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
