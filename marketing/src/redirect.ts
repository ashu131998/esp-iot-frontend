export const SESSION_HINT_COOKIE = 'fb_home';

const FACTORY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FACTORY_HOME_RE = /^\/factories\/[A-Za-z0-9_-]{1,64}$/;
const STAFF_HOME = '/internal';

export interface Origins {
  APP_ORIGIN: string;
  STAFF_ORIGIN: string;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Dashboard URL for a signed-in visitor, from the hint cookie the app sets on
 * the parent domain. Only whitelisted path shapes are accepted, so the cookie
 * can never turn this site into an open redirect.
 */
export function signedInHome(cookieHeader: string | null, origins: Origins): string | null {
  const home = readCookie(cookieHeader, SESSION_HINT_COOKIE);
  if (!home) return null;
  if (home === STAFF_HOME) return `${origins.STAFF_ORIGIN}${STAFF_HOME}`;
  if (FACTORY_HOME_RE.test(home)) return `${origins.APP_ORIGIN}${home}`;
  return null;
}

/** Factory login URL for the `/login?factory=<id>` form, or null if the id is invalid. */
export function factoryLoginUrl(factory: string | null, origins: Origins): string | null {
  const id = factory?.trim() ?? '';
  if (!FACTORY_ID_RE.test(id)) return null;
  return `${origins.APP_ORIGIN}/f/${id}/login`;
}
