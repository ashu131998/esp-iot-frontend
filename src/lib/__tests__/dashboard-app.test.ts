/**
 * The FloorBeat app (the dashboard on a phone): its address (lib/hosts.ts), where it goes once signed
 * in (lib/dashboard-app.ts), and a session it cannot renew (app/api/auth/session-restore/route.ts):
 * back to the address asked for, where the sign-in shows in place.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  afterDashboardSignIn, APP_HOME, APP_OVERVIEW, appTiles, DASHBOARD_ANDROID_APP_ID, DASHBOARD_APK_URL, DASHBOARD_APP_NAME, homeTarget, INBOX_BASE, inboxHref, TILE_HREF,
} from '@/lib/dashboard-app';
import { RESERVED_SUBDOMAINS, dashboardAppHost, isAlertsAppHost, isDashboardAppHost, isFactorySubdomain } from '@/lib/hosts';

const { GET } = await import('@/app/api/auth/session-restore/route');

describe('the app\'s address', () => {
  it('dashboard.<suffix>, in every environment', () => {
    expect(dashboardAppHost('.floorbeat.in')).toBe('dashboard.floorbeat.in');
    expect(dashboardAppHost('stage.floorbeat.in')).toBe('dashboard.stage.floorbeat.in');
    expect(dashboardAppHost('')).toBeNull();
    expect(dashboardAppHost(undefined)).toBeNull();
  });

  it('is told from every other address, whatever the port or the letter case', () => {
    expect(isDashboardAppHost('dashboard.floorbeat.in', '.floorbeat.in')).toBe(true);
    expect(isDashboardAppHost('DASHBOARD.floorbeat.in:443', '.floorbeat.in')).toBe(true);
    expect(isDashboardAppHost('dashboard.stage.floorbeat.in', '.stage.floorbeat.in')).toBe(true);
    expect(isDashboardAppHost('dashboard.floorbeat.in', '.stage.floorbeat.in')).toBe(false);
    for (const other of ['alerts.floorbeat.in', 'shree-mills.floorbeat.in', 'floorbeat.in', 'dashboard.example.com']) {
      expect(isDashboardAppHost(other, '.floorbeat.in'), other).toBe(false);
    }
    expect(isDashboardAppHost(null, '.floorbeat.in')).toBe(false);
    expect(isDashboardAppHost('dashboard.floorbeat.in', '')).toBe(false);
    expect(isAlertsAppHost('dashboard.floorbeat.in', '.floorbeat.in')).toBe(false);
  });

  it('a local run names its own', () => {
    expect(isDashboardAppHost('dashboard.localhost:3105', '', 'dashboard.localhost')).toBe(true);
    expect(isDashboardAppHost('localhost:3105', '', 'dashboard.localhost')).toBe(false);
  });

  it('no factory can take it', () => {
    expect(RESERVED_SUBDOMAINS.has('dashboard')).toBe(true);
    expect(isFactorySubdomain('dashboard')).toBe(false);
  });

  it('the app\'s name and its Android package: the alerts app\'s, which the one app updates (its push stays)', () => {
    expect(DASHBOARD_APP_NAME).toBe('FloorBeat');
    expect(DASHBOARD_ANDROID_APP_ID).toBe('in.floorbeat.alerts');
    expect(DASHBOARD_APK_URL).toBe('https://floorbeat.in/downloads/floorbeat.apk');
  });
});

describe('once signed in', () => {
  it('the page asked for, else the address the sign-in showed at, else home', () => {
    expect(afterDashboardSignIn('/support?ticket=tkt-1', '/')).toBe('/support?ticket=tkt-1');
    expect(afterDashboardSignIn(null, '/alerts?x=1')).toBe('/alerts?x=1');
    expect(afterDashboardSignIn(null)).toBe('/');   // the home screen
    expect(afterDashboardSignIn(undefined, undefined)).toBe(APP_HOME);
  });

  it('never a sign-in page, the app\'s inner address or another site', () => {
    for (const bad of ['/login', '/login?next=%2Fx', '/signup/', '/forgot-password', '/f/shree-mills/login', '/dashboard-app/login', '/dashboard-app', '//evil.example', 'https://evil.example/']) {
      expect(afterDashboardSignIn(bad, '/alerts'), bad).toBe('/alerts');
      expect(afterDashboardSignIn(null, bad), bad).toBe('/');
    }
    expect(afterDashboardSignIn('/login-history')).toBe('/login-history');   // a page of the factory's, were there one
  });
});

describe('a session the app cannot renew', () => {
  beforeEach(() => {
    vi.stubEnv('FACTORY_HOST_SUFFIX', '.floorbeat.in');
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test');
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const restore = (next: string | null, cookie?: string) => {
    const url = `https://dashboard.floorbeat.in/api/auth/session-restore${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    return GET(new NextRequest(url, { headers: { host: 'dashboard.floorbeat.in', ...(cookie ? { cookie } : {}) } }));
  };

  it('no session left: back to the address asked for, where the sign-in shows in place', async () => {
    expect((await restore('/alerts')).headers.get('location')).toBe('https://dashboard.floorbeat.in/alerts');
    expect((await restore(null)).headers.get('location')).toBe('https://dashboard.floorbeat.in/');
  });

  it('a renewal the server refuses: back there with the session cookies cleared', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const res = await restore('/support?ticket=tkt-1', 'esp_refresh=r-old');
    expect(res.headers.get('location')).toBe('https://dashboard.floorbeat.in/support?ticket=tkt-1');
    expect(res.headers.get('set-cookie')).toMatch(/esp_refresh=;[^,]*Max-Age=0/i);
  });
});

describe('the home screen of apps (one app: alerts, dashboard, stock)', () => {
  it('opens at the app\'s root; the dashboard\'s overview is /overview, the alerts /inbox, the stock /ims', () => {
    expect(APP_HOME).toBe('/');
    expect(APP_OVERVIEW).toBe('/overview');
    expect(INBOX_BASE).toBe('/inbox');
    expect(TILE_HREF).toEqual({ alerts: '/inbox', dashboard: '/overview', stock: '/ims' });
  });

  it('a tile for each app the factory has: alerts unless switched off, the dashboard always, the stock where the IMS is on', () => {
    expect(appTiles({ ims: true })).toEqual(['alerts', 'dashboard', 'stock']);
    expect(appTiles({})).toEqual(['alerts', 'dashboard']);   // the IMS needs an explicit on (an app page)
    expect(appTiles(null)).toEqual(['alerts', 'dashboard']);
    expect(appTiles({ alerts_app: false, ims: true })).toEqual(['dashboard', 'stock']);
    expect(appTiles({ alerts_app: false, ims: false })).toEqual(['dashboard']);
  });

  it('with one app only, the home screen opens it', () => {
    expect(homeTarget(['dashboard'])).toBe('/overview');
    expect(homeTarget(['alerts', 'dashboard'])).toBeNull();
    expect(homeTarget(['alerts', 'dashboard', 'stock'])).toBeNull();
  });

  it('an alert\'s page (as the alerts app names it) at its address inside the app', () => {
    expect(inboxHref('/')).toBe('/inbox');
    expect(inboxHref('')).toBe('/inbox');
    expect(inboxHref('/alerts/ntf-1')).toBe('/inbox/alerts/ntf-1');
    expect(inboxHref('/settings')).toBe('/inbox/settings');
    expect(inboxHref('settings')).toBe('/inbox/settings');
  });
});
