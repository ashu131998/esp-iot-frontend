import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE } from '@/lib/auth-types';
import { loginRedirectPath, safeNextPath } from '@/lib/auth-redirect';
import { cfAccessBlockMessage, cfAccessOk } from '@/lib/cf-access';
import { factoryFromHost, isFactorySubdomain, parseStaffHostRoles, staffHostForRole, staffRoleAllowedOnHost } from '@/lib/hosts';
import { internalHostAllowed, internalHostBlockResponse } from '@/lib/internal-host';
import { isStaffRole } from '@/lib/internal-auth';

/**
 * Edge middleware: route protection + RBAC redirects, per-request CSP nonce, and
 * security headers. The backend remains authoritative; this is defense-in-depth
 * plus UX routing. It only *reads* the access token to determine role/factory;
 * it does not verify refresh tokens inline; expired access JWTs with a refresh
 * cookie go through GET /api/auth/session-restore (API calls refresh via the BFF).
 */

const LEGACY_PLATFORM_REDIRECTS: Record<string, string> = {
  '/overview': '/internal',
  '/factories': '/internal/factories',
  '/alerts': '/internal/alerts',
  '/settings': '/internal/health',
  '/admin': '/internal',
  '/admin/login': '/internal/login',
};

const FACTORY_HOME_RE = /^\/factories\/[A-Za-z0-9_-]{1,64}$/;

/** The address asked for: the Host header (next dev puts localhost in nextUrl), else nextUrl. */
function requestHost(req: NextRequest): string {
  return req.headers.get('host') ?? req.nextUrl.hostname;
}

/** A path segment as written, also when its %-escapes are broken. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

interface Identity {
  role: string;
  factoryId: string | null;
}

async function getIdentity(req: NextRequest): Promise<Identity | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    if (!role) return null;
    const factoryId =
      typeof payload.factory_id === 'string' ? payload.factory_id : null;
    return { role, factoryId };
  } catch {
    return null;
  }
}

/** Where an authenticated user belongs when blocked from the requested route. */
function homeFor(identity: Identity, req: NextRequest): string {
  if (isStaffRole(identity.role)) {
    return internalHostAllowed(req) ? '/internal' : '/';
  }
  if (identity.factoryId) return `/factories/${identity.factoryId}`;
  return internalHostAllowed(req) ? '/internal/login' : '/';
}

function isInternalWritePath(pathname: string): boolean {
  return (
    pathname === '/internal/onboard' ||
    pathname === '/internal/features' ||
    pathname.startsWith('/internal/onboard/') ||
    pathname.startsWith('/internal/features/')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // The factory whose own address this is (<factory>.floorbeat.in), if any.
  const hostFactory = factoryFromHost(requestHost(req), process.env.FACTORY_HOST_SUFFIX);

  const legacyTarget = hostFactory ? undefined : LEGACY_PLATFORM_REDIRECTS[pathname];
  if (legacyTarget) {
    if (legacyTarget.startsWith('/internal') && !internalHostAllowed(req)) {
      return internalHostBlockResponse();
    }
    const url = req.nextUrl.clone();
    url.pathname = legacyTarget;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const secured = () => withSecurity(NextResponse.next({ request: { headers: requestHeaders } }));

  /** Serve another route of the app at this address (the address bar keeps the plain one). */
  const securedRewrite = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return withSecurity(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  };

  function withSecurity(res: NextResponse) {
    applySecurityHeaders(res, csp);
    if (!req.cookies.get(CSRF_COOKIE)) {
      res.cookies.set(CSRF_COOKIE, crypto.randomUUID().replace(/-/g, ''), {
        httpOnly: false,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
      });
    }
    return res;
  }

  const redirectTo = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url);
  };

  /** Access JWT expired but refresh cookie may still be valid — renew without flashing the login page. */
  const redirectToSessionRestore = () => {
    const returnPath = `${pathname}${req.nextUrl.search}`;
    const next = safeNextPath(returnPath) ?? '/';
    const url = req.nextUrl.clone();
    url.pathname = '/api/auth/session-restore';
    url.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  };

  // Renewing the session silently makes sense only when it is this address's own session.
  let restoreAllowed = true;

  // Not signed in (or the cookies did not come: a click from an email is cross-site and they
  // are SameSite=Strict): the factory login, which renews the session if it can and comes back.
  const redirectToLogin = (factoryId: string) => {
    if (restoreAllowed && req.cookies.get(REFRESH_COOKIE)?.value) return redirectToSessionRestore();
    const [path, query] = loginRedirectPath(factoryId, pathname, req.nextUrl.search).split('?');
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = query ? `?${query}` : '';
    return NextResponse.redirect(url);
  };

  const redirectToInternalLogin = () => {
    if (req.cookies.get(REFRESH_COOKIE)?.value) return redirectToSessionRestore();
    const url = req.nextUrl.clone();
    url.pathname = '/internal/login';
    const next = safeNextPath(`${pathname}${req.nextUrl.search}`);
    url.search = next ? `?next=${encodeURIComponent(next)}` : '';
    return NextResponse.redirect(url);
  };

  let identity = await getIdentity(req);

  // A factory's own address (<factory>.floorbeat.in): that factory alone, at plain addresses —
  // /login to sign in, / its dashboard, /energy, /machines/… its pages (served from the app's
  // /f/<id>/… and /factories/<id>/… inside). Someone signed in for another factory counts as
  // signed out here, and is never renewed into a loop.
  if (hostFactory) {
    if (identity && !isStaffRole(identity.role) && identity.factoryId?.toLowerCase() !== hostFactory) {
      identity = null;
      restoreAllowed = false;
    }
    // An address in the app's own form (/f/<id>/login, /factories/<id>/energy): the same page at its
    // plain address; another factory's: the dashboard.
    const inner = pathname.match(/^\/(?:f|factories)\/([^/]+)(\/.*)?$/);
    if (inner) {
      const same = decodeSegment(inner[1]).toLowerCase() === hostFactory;
      const url = req.nextUrl.clone();
      url.pathname = same ? (inner[2] ?? '/') : '/';
      if (!same) url.search = '';
      return NextResponse.redirect(url);
    }
    if (pathname === '/internal' || pathname.startsWith('/internal/')) return internalHostBlockResponse();
    if (pathname === '/reset-password' || pathname === '/reset-password/') return secured();
    const auth = pathname.match(/^\/(login|signup|forgot-password)\/?$/);
    if (auth) {
      if (identity) return redirectTo('/');
      return securedRewrite(`/f/${hostFactory}/${auth[1]}`);
    }
    if (!identity) {
      if (restoreAllowed && req.cookies.get(REFRESH_COOKIE)?.value) return redirectToSessionRestore();
      const next = pathname === '/' ? null : safeNextPath(`${pathname}${req.nextUrl.search}`);
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = next ? `?next=${encodeURIComponent(next)}` : '';
      return NextResponse.redirect(url);
    }
    if (/^\/team(\/|$)/.test(pathname) && identity.role !== 'super_admin' && identity.role !== 'admin') return redirectTo('/');
    return securedRewrite(`/factories/${hostFactory}${pathname === '/' ? '' : pathname}`);
  }

  // The customer Worker on an address that is not a factory's (app.floorbeat.in, gone; workers.dev):
  // a link to a factory goes to that factory's own address, a staff reset link to the staff console,
  // anything else to the website. Old emails keep working.
  const factorySuffix = process.env.FACTORY_HOST_SUFFIX?.trim();
  if (factorySuffix && !hostFactory && !internalHostAllowed(req)) {
    const scheme = req.nextUrl.protocol;
    const rest = `${pathname}${req.nextUrl.search}`;
    const page = pathname.match(/^\/(?:factories|f)\/([^/]+)(\/.*)?$/);
    const linked = page ? decodeSegment(page[1]).toLowerCase() : req.nextUrl.searchParams.get('factory')?.trim().toLowerCase();
    if ((page || pathname === '/reset-password') && linked && isFactorySubdomain(linked)) {
      const plain = page ? `${page[2] ?? '/'}${req.nextUrl.search}` : rest;
      return NextResponse.redirect(`${scheme}//${linked}${factorySuffix.startsWith('.') ? '' : '.'}${factorySuffix}${plain}`);
    }
    const staffUrl = process.env.STAFF_URL?.trim();
    if (pathname === '/reset-password' && staffUrl) return NextResponse.redirect(`${new URL(staffUrl).origin}${rest}`);
    const marketingUrl = process.env.MARKETING_URL?.trim();
    if (marketingUrl) return NextResponse.redirect(marketingUrl);
  }

  // Public pages of a factory: sign in, sign up and "forgot password" (a signed-in person is sent home).
  const isFactoryAuthPage = /^\/f\/[^/]+\/(login|signup|forgot-password)\/?$/.test(pathname);
  const isInternalLogin = pathname === '/internal/login' || pathname === '/internal/forgot-password';
  if (isInternalLogin) {
    if (!internalHostAllowed(req)) {
      return internalHostBlockResponse();
    }
    if (identity) return redirectTo(homeFor(identity, req));
    return secured();
  }
  if (isFactoryAuthPage) {
    if (identity) return redirectTo(homeFor(identity, req));
    return secured();
  }

  const facMatch = pathname.match(/^\/factories\/([^/]+)(?:\/(.*))?$/);
  if (facMatch) {
    const factoryId = facMatch[1];
    const sub = facMatch[2] ?? '';
    if (!identity) return redirectToLogin(factoryId);
    const allowed =
      isStaffRole(identity.role) || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity, req));
    if (sub.startsWith('team')) {
      const isAdmin =
        identity.role === 'super_admin' ||
        (identity.role === 'admin' && identity.factoryId === factoryId);
      if (!isAdmin) return redirectTo(`/factories/${factoryId}`);
    }
    return secured();
  }

  if (pathname === '/internal/settings') {
    if (!internalHostAllowed(req)) return internalHostBlockResponse();
    return redirectTo('/internal/health');
  }

  if (pathname === '/internal/devices' || pathname === '/internal/devices/') {
    if (!internalHostAllowed(req)) return internalHostBlockResponse();
    const url = req.nextUrl.clone();
    url.pathname = '/internal/nodes';
    return NextResponse.redirect(url);
  }

  if (pathname === '/internal' || pathname.startsWith('/internal/')) {
    if (!internalHostAllowed(req)) {
      return internalHostBlockResponse();
    }
    if (!cfAccessOk(req)) {
      return new NextResponse(cfAccessBlockMessage(), { status: 403 });
    }
    if (!identity) return redirectToInternalLogin();
    if (!isStaffRole(identity.role)) return redirectTo(homeFor(identity, req));
    // superadmin.floorbeat.in is the super admin's, admin.floorbeat.in the staff's (STAFF_HOST_ROLES).
    const staffHosts = parseStaffHostRoles(process.env.STAFF_HOST_ROLES);
    if (!staffRoleAllowedOnHost(requestHost(req), identity.role, staffHosts)) {
      const own = staffHostForRole(identity.role, staffHosts);
      if (!own) return internalHostBlockResponse();
      const port = requestHost(req).split(':')[1];   // none in production; kept for a local run
      return NextResponse.redirect(`${req.nextUrl.protocol}//${own}${port ? `:${port}` : ''}/internal`);
    }
    if (
      isInternalWritePath(pathname) &&
      identity.role === 'internal_viewer'
    ) {
      return redirectTo('/internal');
    }
    if (pathname.startsWith('/internal/audit') && identity.role !== 'super_admin') {
      return redirectTo('/internal');
    }
    return secured();
  }

  const fMatch = pathname.match(/^\/f\/([^/]+)(?:\/(.*))?$/);
  if (fMatch) {
    const factoryId = fMatch[1];
    if (!identity) return redirectToLogin(factoryId);
    const allowed =
      isStaffRole(identity.role) || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity, req));
    return secured();
  }

  if (pathname === '/') {
    if (!identity) {
      if (internalHostAllowed(req)) return redirectTo('/internal/login');
      // Only where this Worker writes the hint: on stage/dev the cookie present
      // on floorbeat.in is production's and names a production factory.
      const hinted = process.env.SESSION_HINT_COOKIE_DOMAIN?.trim()
        ? req.cookies.get(SESSION_HINT_COOKIE)?.value
        : undefined;
      if (hinted && FACTORY_HOME_RE.test(hinted)) return redirectTo(hinted);
      const marketingUrl = process.env.MARKETING_URL?.trim();
      if (marketingUrl) return NextResponse.redirect(marketingUrl);
      return secured();
    }
    const staffUrl = process.env.STAFF_URL?.trim();
    if (staffUrl && isStaffRole(identity.role) && !internalHostAllowed(req)) {
      return NextResponse.redirect(staffUrl);
    }
    const home = homeFor(identity, req);
    if (home === pathname) return secured();
    return redirectTo(home);
  }

  return secured();
}

function applySecurityHeaders(res: NextResponse, csp: string) {
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  );
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
