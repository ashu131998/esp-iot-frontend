export const SESSION_HINT_COOKIE = 'fb_home';

const FACTORY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FACTORY_HOME_RE = /^\/factories\/[A-Za-z0-9_-]{1,64}$/;
const STAFF_HOME = '/internal';

export interface Origins {
  APP_ORIGIN: string;
  STAFF_ORIGIN: string;
  /** ".floorbeat.in" in production: each factory has its own address, <id>.floorbeat.in. */
  FACTORY_HOST_SUFFIX?: string;
}

/** One DNS label: a factory ID that can be its own address. */
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Where a factory's pages live: its own address in production (FACTORY_HOST_SUFFIX), else the app. */
export function factoryOrigin(factoryId: string, origins: Origins): string {
  const suffix = origins.FACTORY_HOST_SUFFIX?.trim();
  const id = factoryId.toLowerCase();
  if (suffix && LABEL_RE.test(id)) return `https://${id}${suffix.startsWith('.') ? '' : '.'}${suffix}`;
  return origins.APP_ORIGIN;
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
  if (FACTORY_HOME_RE.test(home)) return `${factoryOrigin(home.split('/')[2], origins)}${home}`;
  return null;
}

const NOT_FOUND_ERROR = 'Factory not found';

/**
 * The factory's real ID, from the API's public lookup, which also finds an ID typed in other
 * letters ("Factory-01" for "factory-01"). False only for a definite "not found"; null when the API
 * can't answer, so an API outage still lets visitors through to the sign-in page.
 */
export async function lookupFactoryId(
  factoryId: string,
  apiOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | false | null> {
  try {
    const res = await fetchImpl(`${apiOrigin}/v1/public/factories/${encodeURIComponent(factoryId)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const found = (await res.json().catch(() => null)) as { factory_id?: unknown } | null;
      const id = typeof found?.factory_id === 'string' ? found.factory_id : '';
      return FACTORY_ID_RE.test(id) ? id : factoryId;
    }
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    // An older API answers 404 for the unknown route itself, with a different body.
    if (res.status === 404 && body?.error === NOT_FOUND_ERROR) return false;
    return null;
  } catch {
    return null;
  }
}

/** Factory login URL for the `/login?factory=<id>` form, or null if the id is invalid. */
export function factoryLoginUrl(factory: string | null, origins: Origins): string | null {
  const id = factory?.trim() ?? '';
  if (!FACTORY_ID_RE.test(id)) return null;
  return `${factoryOrigin(id, origins)}/f/${id}/login`;
}

/**
 * Pages a signed-in visitor still sees instead of being sent to their dashboard: the ROI
 * calculator and the partners page are shared with prospects, and staff open them signed in.
 */
const ALWAYS_SHOWN = new Set(['/roi', '/partners']);

export function alwaysShown(pathname: string): boolean {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return ALWAYS_SHOWN.has(path);
}

/**
 * Dashboard and staff addresses that reach the website because they lost their subdomain, as
 * happens when a link is copied out of a phone's mail app ("floorbeat.in/f/factory-01/login"): the
 * same address on the right host, so they never end on "page not found". Only plain path segments
 * pass ([A-Za-z0-9_-], no "//", no dots), and the host is ours, so this cannot redirect elsewhere.
 */
const APP_PATH_RE = /^\/(?:f|factories)\/[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]+)*\/?$/;
const APP_EXACT = new Set(['/reset-password', '/reset-password/']);
const STAFF_PATH_RE = /^\/internal(?:\/[A-Za-z0-9_-]+)*\/?$/;

export function forwardTarget(pathname: string, search: string, origins: Origins): string | null {
  if (APP_PATH_RE.test(pathname)) return `${factoryOrigin(pathname.split('/')[2], origins)}${pathname}${search}`;
  if (APP_EXACT.has(pathname)) {
    // A factory account's reset link goes to its factory; a staff account's to the staff console
    // (production has no app address any more), or to the app on stage and dev, as before.
    const factory = new URLSearchParams(search).get('factory');
    if (factory && FACTORY_ID_RE.test(factory)) return `${factoryOrigin(factory, origins)}${pathname}${search}`;
    return `${origins.FACTORY_HOST_SUFFIX?.trim() ? origins.STAFF_ORIGIN : origins.APP_ORIGIN}${pathname}${search}`;
  }
  if (STAFF_PATH_RE.test(pathname)) return `${origins.STAFF_ORIGIN}${pathname}${search}`;
  return null;
}
