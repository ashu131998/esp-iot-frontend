import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { AppGate } from '@/components/alerts-app/app-gate';
import { SwBoot } from '@/components/alerts-app/sw-boot';
import { webAppInstallable } from '@/lib/alerts-app/install';
import { isDashboardAppHost } from '@/lib/hosts';

/** Inside the FloorBeat app (dashboard.floorbeat.in/inbox): these are its Alerts, not a separate app. */
async function inFloorBeatApp(): Promise<boolean> {
  return isDashboardAppHost((await headers()).get('host'), process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST);
}

/**
 * FloorBeat Alerts, the phone app, served at alerts.floorbeat.in (src/middleware.ts rewrites its
 * plain addresses here). A web app installed on an iPhone's Home Screen: the manifest
 * (public/alerts-app.webmanifest, offered to iPhones and iPads only: Android has the APK), the
 * iPhone home-screen settings, and the service worker that shows the pushes (public/alerts-sw.js).
 * Every page opens only as the app, from an iPhone's Home Screen or inside the Android app; a
 * browser tab or a computer is told how to get it (components/alerts-app/app-gate.tsx).
 */
const METADATA: Metadata = {
  title: 'FloorBeat Alerts',
  description: 'Machine alerts from FloorBeat on your phone: know the minute a machine stops, and answer from the floor.',
  appleWebApp: { capable: true, title: 'FloorBeat Alerts', statusBarStyle: 'default' },
  // Next writes the standard mobile-web-app-capable; older iPhones still read Apple's own name.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  formatDetection: { telephone: false },
};

export async function generateMetadata(): Promise<Metadata> {
  // the FloorBeat app's own name, icon and manifest (the root layout's)
  if (await inFloorBeatApp()) return {};
  const userAgent = (await headers()).get('user-agent');
  return webAppInstallable(userAgent) ? { ...METADATA, manifest: '/alerts-app.webmanifest' } : METADATA;
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function AlertsAppLayout({ children }: { children: React.ReactNode }) {
  // Inside the FloorBeat app, which opens in a browser too, the pages open where they are; the app ringing is
  // the signed-in layout's (NotificationsGate installedOnly).
  const inside = await inFloorBeatApp();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {inside ? (
        <>
          <SwBoot />
          {children}
        </>
      ) : (
        <AppGate>
          <SwBoot />
          {children}
        </AppGate>
      )}
    </div>
  );
}
