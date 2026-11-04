/**
 * Which part of FloorBeat an address serves (production):
 *  - <factory>.floorbeat.in: that factory alone, its sign-in and everything else (FACTORY_HOST_SUFFIX
 *    on the customer Worker);
 *  - superadmin.floorbeat.in: the staff console for the super admin; admin.floorbeat.in: the staff
 *    console for FloorBeat's staff (STAFF_HOST_ROLES on the staff Worker);
 *  - app, ops, www, api and every stage- / dev- address: FloorBeat's own, never a factory.
 * The backend keeps the same reserved list (query-api/src/factory-host.js) for new factory IDs.
 */

/** Addresses FloorBeat keeps for itself: no factory may be called this. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'app', 'ops', 'www', 'api', 'admin', 'superadmin', 'staff', 'internal', 'console', 'dashboard', 'portal',
  'login', 'signin', 'signup', 'auth', 'sso', 'id', 'account', 'accounts', 'my',
  'mail', 'email', 'smtp', 'imap', 'pop', 'mx', 'webmail', 'autodiscover', 'autoconfig',
  'status', 'health', 'docs', 'help', 'support', 'blog', 'news', 'legal', 'privacy', 'terms',
  'sales', 'hello', 'billing', 'pay', 'payments', 'shop', 'store', 'partners',
  'cdn', 'static', 'assets', 'media', 'files', 'img', 'images', 'download', 'downloads',
  'mqtt', 'broker', 'emqx', 'ota', 'firmware', 'grafana', 'metrics', 'monitor', 'monitoring',
  'webhook', 'webhooks', 'hooks', 'push', 'alerts', 'm', 'mobile',
  'dev', 'stage', 'staging', 'test', 'testing', 'sandbox', 'beta', 'preview', 'demo-app', 'localhost',
]);

/** Prefixes kept for FloorBeat's environments (stage-ops, dev-app, api-stage …) and for punycode. */
export const RESERVED_PREFIXES: readonly string[] = ['stage-', 'dev-', 'api-', 'xn--'];

/** One DNS label: lowercase letters, digits and hyphens, a letter or digit at each end, up to 63. */
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Whether a factory ID can be its own address (<id>.floorbeat.in). */
export function isFactorySubdomain(id: string): boolean {
  const label = id.trim().toLowerCase();
  return LABEL_RE.test(label) && !RESERVED_SUBDOMAINS.has(label) && !RESERVED_PREFIXES.some((p) => label.startsWith(p));
}

/** Why a new factory ID cannot be its address, or null when it can. */
export function factorySubdomainProblem(id: string): string | null {
  const label = id.trim().toLowerCase();
  if (!LABEL_RE.test(label)) {
    return 'Lowercase letters, digits and hyphens, starting and ending with a letter or digit (up to 63): it becomes the factory\'s address';
  }
  if (RESERVED_SUBDOMAINS.has(label) || RESERVED_PREFIXES.some((p) => label.startsWith(p))) {
    return `"${label}" is kept for FloorBeat itself: pick another ID`;
  }
  return null;
}

const bare = (hostname: string) => hostname.trim().toLowerCase().split(':')[0] ?? '';

/**
 * The factory an address belongs to: "shree-mills.floorbeat.in" → "shree-mills" (suffix ".floorbeat.in").
 * Null for FloorBeat's own addresses, anything else, or when no suffix is set (stage, dev, local).
 */
export function factoryFromHost(hostname: string | null | undefined, suffix: string | null | undefined): string | null {
  const s = (suffix ?? '').trim().toLowerCase();
  if (!hostname || !s) return null;
  const dotted = s.startsWith('.') ? s : `.${s}`;
  const host = bare(hostname);
  if (!host.endsWith(dotted)) return null;
  const label = host.slice(0, -dotted.length);
  return isFactorySubdomain(label) ? label : null;
}

/**
 * Who may use each staff address: "superadmin.floorbeat.in=super_admin;admin.floorbeat.in=internal_admin,internal_viewer".
 * A staff address not listed takes every staff role (ops, workers.dev, local).
 */
export function parseStaffHostRoles(raw: string | null | undefined): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  for (const part of (raw ?? '').split(';')) {
    const [host, roles] = part.split('=');
    const h = bare(host ?? '');
    const list = (roles ?? '').split(',').map((r) => r.trim()).filter(Boolean);
    if (h && list.length > 0) rules.set(h, list);
  }
  return rules;
}

/** Whether this staff role may use the staff console at this address. */
export function staffRoleAllowedOnHost(hostname: string, role: string, rules: Map<string, string[]>): boolean {
  const roles = rules.get(bare(hostname));
  return !roles || roles.includes(role);
}

/** The staff address where this role belongs (the first one listing it), or null. */
export function staffHostForRole(role: string, rules: Map<string, string[]>): string | null {
  for (const [host, roles] of rules) if (roles.includes(role)) return host;
  return null;
}
