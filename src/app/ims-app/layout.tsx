import type { Metadata, Viewport } from 'next';

/**
 * FloorBeat IMS, the stock app, served at ims.floorbeat.in (src/middleware.ts rewrites its plain
 * addresses here). A web app for the Home Screen of any phone (public/ims-app.webmanifest): unlike the
 * other two apps it is offered to Android too, since IMS comes to Android as a web app first and as
 * its own app (in.floorbeat.ims) later.
 */
export const metadata: Metadata = {
  title: 'FloorBeat IMS',
  description: 'Your factory\'s stock on your phone: scan pallets in, move them, take them out, and see what is in stock.',
  manifest: '/ims-app.webmanifest',
  appleWebApp: { capable: true, title: 'FloorBeat IMS', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  formatDetection: { telephone: false },
  icons: { apple: '/ims-apple-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function ImsAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
