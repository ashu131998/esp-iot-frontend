/**
 * Getting signed-in people to the page they asked for.
 *
 * The sign-in cookies are SameSite=Strict, so a click from another site (a link
 * in an email) arrives without them, and the 15-minute access token may have run
 * out anyway: the middleware then sends the request to the factory login page
 * with ?next=<the page>. There, a same-site call renews the 7-day session if it
 * is still there, and the page opens without asking for the password again.
 */

/** Where a login should go next: only a path inside this app (never another site, never a login page). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== 'string') return null;
  const path = next.trim();
  // One leading slash, not "//host" or "/\\host" (browsers read both as another site).
  if (!/^\/(?![/\\])/.test(path)) return null;
  if (/[\u0000-\u001f\\]/.test(path)) return null;   // control characters, backslashes
  if (/^\/(f\/[^/?#]+\/(login|signup)|internal\/login)\/?([?#]|$)/.test(path)) return null;
  return path;
}

/** The factory login page that sends the person back to `pathname` + `search` once signed in. */
export function loginRedirectPath(factoryId: string, pathname: string, search = ''): string {
  const next = safeNextPath(`${pathname}${search}`);
  const login = `/f/${encodeURIComponent(factoryId)}/login`;
  return next ? `${login}?next=${encodeURIComponent(next)}` : login;
}

/** Don't try the silent sign-in again within this long (a loop guard if it cannot stick). */
export const RESTORE_RETRY_MS = 15_000;
const RESTORE_KEY = 'fb_restore_at';

/** Whether to try renewing the session silently now (not if we just did, and it came back here). */
export function shouldTryRestore(storage: Pick<Storage, 'getItem'> | null, nowMs = Date.now()): boolean {
  try {
    const last = Number(storage?.getItem(RESTORE_KEY) ?? 0);
    return !(last > 0 && nowMs - last < RESTORE_RETRY_MS);
  } catch {
    return true;
  }
}

export function noteRestore(storage: Pick<Storage, 'setItem'> | null, nowMs = Date.now()): void {
  try {
    storage?.setItem(RESTORE_KEY, String(nowMs));
  } catch {
    /* private mode / storage off: the guard just does not apply */
  }
}
