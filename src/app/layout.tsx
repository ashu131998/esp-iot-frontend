import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
