import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-types';
import { cfAccessBlockMessage, cfAccessOk } from '@/lib/cf-access';
import { isStaffRole } from '@/lib/internal-auth';

/**
 * Edge middleware: route protection + RBAC redirects, per-request CSP nonce, and
 * security headers. The backend remains authoritative; this is defense-in-depth
 * plus UX routing. It only *reads* the access token to determine role/factory;
 * it never refreshes (the BFF proxy auto-refreshes on data calls).
 */

const LEGACY_PLATFORM_REDIRECTS: Record<string, string> = {
  '/overview': '/internal',
  '/factories': '/internal/factories',
  '/alerts': '/internal/alerts',
  '/settings': '/internal/health',
  '/admin': '/internal',
  '/admin/login': '/internal/login',
};

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
function homeFor(identity: Identity): string {
  if (isStaffRole(identity.role)) return '/internal';
  if (identity.factoryId) return `/factories/${identity.factoryId}`;
  return '/internal/login';
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

  const legacyTarget = LEGACY_PLATFORM_REDIRECTS[pathname];
  if (legacyTarget) {
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

  const secured = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
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
  };

  const redirectTo = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url);
  };

  const identity = await getIdentity(req);

  const isFactoryAuthPage = /^\/f\/[^/]+\/(login|signup)\/?$/.test(pathname);
  const isInternalLogin = pathname === '/internal/login';
  if (isFactoryAuthPage || isInternalLogin) {
    if (identity) return redirectTo(homeFor(identity));
    return secured();
  }

  const facMatch = pathname.match(/^\/factories\/([^/]+)(?:\/(.*))?$/);
  if (facMatch) {
    const factoryId = facMatch[1];
    const sub = facMatch[2] ?? '';
    if (!identity) return redirectTo(`/f/${factoryId}/login`);
    const allowed =
      isStaffRole(identity.role) || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity));
    if (sub.startsWith('team')) {
      const isAdmin =
        identity.role === 'super_admin' ||
        (identity.role === 'admin' && identity.factoryId === factoryId);
      if (!isAdmin) return redirectTo(`/factories/${factoryId}`);
    }
    return secured();
  }

  if (pathname === '/internal/settings') {
    return redirectTo('/internal/health');
  }

  if (pathname === '/internal/devices' || pathname === '/internal/devices/') {
    const url = req.nextUrl.clone();
    url.pathname = '/internal/nodes';
    return NextResponse.redirect(url);
  }

  if (pathname === '/internal' || pathname.startsWith('/internal/')) {
    if (!cfAccessOk(req)) {
      return new NextResponse(cfAccessBlockMessage(), { status: 403 });
    }
    if (!identity) return redirectTo('/internal/login');
    if (!isStaffRole(identity.role)) return redirectTo(homeFor(identity));
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
    if (!identity) return redirectTo(`/f/${factoryId}/login`);
    const allowed =
      isStaffRole(identity.role) || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity));
    return secured();
  }

  if (pathname === '/') {
    if (!identity) return redirectTo('/internal/login');
    return redirectTo(homeFor(identity));
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
