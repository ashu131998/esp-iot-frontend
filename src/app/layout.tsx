import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { getLocale, getMessages } from '@/lib/i18n/server';

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

export const metadata: Metadata = {
  title: 'FloorBeat',
  description: 'Industrial IoT monitoring and analytics for multi-factory operations',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the phone bottom bar sit clear of the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The language (cookie, else the browser's) decides the page from the first byte: no flash of
  // English on a Hindi dashboard. English needs no messages; Hindi's come along for the client.
  const locale = await getLocale();
  const messages = await getMessages(locale);
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
