import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';

import { webAppInstallable } from '@/lib/alerts-app/install';
import { DASHBOARD_APP_NAME } from '@/lib/dashboard-app';
import { isDashboardAppHost } from '@/lib/hosts';
import { getLocale, getMessages } from '@/lib/i18n/server';
import { sessionUser } from '@/lib/server/session-user';

import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const METADATA: Metadata = {
  title: 'FloorBeat',
  description: 'Industrial IoT monitoring and analytics for multi-factory operations',
  // public/: a file here in app/ would take the place of the FloorBeat app's own icon below.
  icons: { apple: '/apple-touch-icon.png' },
};

/**
 * At the FloorBeat app's address (dashboard.floorbeat.in, lib/dashboard-app.ts) every page is the app:
 * its own Home Screen icon and name, and its manifest (public/dashboard-app.webmanifest), offered to
 * iPhones and iPads only, as the alerts app's is: Android has the APK.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  if (!isDashboardAppHost(h.get('host'), process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST)) return METADATA;
  return {
    ...METADATA,
    description: 'Your factory\'s dashboard on your phone: which machines are running, what stopped and for how long.',
    appleWebApp: { capable: true, title: DASHBOARD_APP_NAME, statusBarStyle: 'default' },
    // Next writes the standard mobile-web-app-capable; older iPhones still read Apple's own name.
    other: { 'apple-mobile-web-app-capable': 'yes' },
    formatDetection: { telephone: false },
    icons: { apple: '/dashboard-apple-icon.png' },
    ...(webAppInstallable(h.get('user-agent')) ? { manifest: '/dashboard-app.webmanifest' } : {}),
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the phone bottom bar sit clear of the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Who is signed in comes with the page (asked for while the language is worked out), so what depends
  // on it is there from the first draw and the browser does not have to ask again.
  const user = sessionUser();
  // The language (cookie, else the browser's) decides the page from the first byte: no flash of
  // English on a Hindi dashboard. English needs no messages; Hindi's come along for the client.
  const locale = await getLocale();
  const messages = await getMessages(locale);
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers locale={locale} messages={messages} initialUser={await user}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
