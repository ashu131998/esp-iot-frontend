import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-types';

/**
 * Edge middleware: route protection + RBAC redirects, per-request CSP nonce, and
 * security headers. The backend remains authoritative; this is defense-in-depth
 * plus UX routing. It only *reads* the access token to determine role/factory;
 * it never refreshes (the BFF proxy auto-refreshes on data calls).
 */

const PLATFORM_PREFIXES = ['/overview', '/factories', '/alerts', '/settings'];

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
  if (identity.role === 'super_admin') return '/overview';
  if (identity.factoryId) return `/factories/${identity.factoryId}`;
  return '/admin/login';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    // Ensure a readable double-submit CSRF cookie exists for client mutations.
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

  // --- Public auth pages ------------------------------------------------------
  const isFactoryAuthPage = /^\/f\/[^/]+\/(login|signup)\/?$/.test(pathname);
  const isAdminLogin = pathname === '/admin/login';
  if (isFactoryAuthPage || isAdminLogin) {
    // Bounce already-authenticated users to their home.
    if (identity) return redirectTo(homeFor(identity));
    return secured();
  }

  // --- Factory dashboards: /factories/{id}/* ---------------------------------
  const facMatch = pathname.match(/^\/factories\/([^/]+)(?:\/(.*))?$/);
  if (facMatch) {
    const factoryId = facMatch[1];
    const sub = facMatch[2] ?? '';
    if (!identity) return redirectTo(`/f/${factoryId}/login`);
    const allowed = identity.role === 'super_admin' || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity));
    // Employee-approval / team management is admin-only within the factory.
    if (sub.startsWith('team')) {
      const isAdmin =
        identity.role === 'super_admin' ||
        (identity.role === 'admin' && identity.factoryId === factoryId);
      if (!isAdmin) return redirectTo(`/factories/${factoryId}`);
    }
    return secured();
  }

  // --- Super-admin console: /admin/* -----------------------------------------
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!identity) return redirectTo('/admin/login');
    if (identity.role !== 'super_admin') return redirectTo(homeFor(identity));
    return secured();
  }

  // --- Platform pages (super-admin only): /overview /factories /alerts /settings
  const isPlatform = PLATFORM_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPlatform) {
    if (!identity) return redirectTo('/admin/login');
    if (identity.role !== 'super_admin') return redirectTo(homeFor(identity));
    return secured();
  }

  // --- Other /f/{id}/* routes (factory-scoped, non-auth pages) ---------------
  const fMatch = pathname.match(/^\/f\/([^/]+)(?:\/(.*))?$/);
  if (fMatch) {
    const factoryId = fMatch[1];
    if (!identity) return redirectTo(`/f/${factoryId}/login`);
    const allowed = identity.role === 'super_admin' || identity.factoryId === factoryId;
    if (!allowed) return redirectTo(homeFor(identity));
    return secured();
  }

  // --- Root ------------------------------------------------------------------
  if (pathname === '/') {
    if (!identity) return redirectTo('/admin/login');
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
}

export const config = {
  // Run on all routes except API handlers, Next internals, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
