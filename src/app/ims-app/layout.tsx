import type { Metadata, Viewport } from 'next';

import { inFloorBeatApp } from '@/lib/server/floorbeat-app';

/**
 * FloorBeat IMS, the stock app, served at ims.floorbeat.in (src/middleware.ts rewrites its plain
 * addresses here). A web app for the Home Screen of any phone (public/ims-app.webmanifest): unlike the
 * other two apps it is offered to Android too, since IMS comes to Android as a web app first and as
 * its own app (in.floorbeat.ims) later.
 *
 * The same screens are the FloorBeat app's Stock (dashboard.floorbeat.in/ims): there they are a part of that
 * app, with its name, icon and manifest (the root layout's), not a second app to add to the Home Screen.
 */
const METADATA: Metadata = {
  title: 'FloorBeat IMS',
  description: 'Your factory\'s stock on your phone: scan pallets in, move them, take them out, and see what is in stock.',
  manifest: '/ims-app.webmanifest',
  appleWebApp: { capable: true, title: 'FloorBeat IMS', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  formatDetection: { telephone: false },
  icons: { apple: '/ims-apple-icon.png' },
};

export async function generateMetadata(): Promise<Metadata> {
  return (await inFloorBeatApp()) ? {} : METADATA;
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function ImsAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
