import type { NextConfig } from 'next';

// Baseline security headers (defense-in-depth). The per-request, nonce-based
// Content-Security-Policy is set in src/middleware.ts; these static headers also
// cover /api routes and static assets that middleware does not run on.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

// What a page may use of the phone: nothing, except the camera on FloorBeat IMS's own address
// (ims.<suffix>, or ims.localhost for a local run), where it reads pallet and location QR codes.
// middleware.ts sets the same on the pages it serves.
const IMS_HOST = { type: 'host' as const, value: 'ims\\..+' };
const permissions = (camera: boolean) => ({
  key: 'Permissions-Policy',
  value: `camera=${camera ? '(self)' : '()'}, microphone=(), geolocation=(), browsing-topics=()`,
});

/** The Stock tab's addresses: /ims… (the FloorBeat app, a factory's own address) and /factories/<id>/ims…. */
const IMS_TAB_PATHS = ['/ims', '/ims/:path*', '/factories/:factoryId/ims', '/factories/:factoryId/ims/:path*'];

const nextConfig: NextConfig = {
  experimental: {
    // How long the browser keeps a page it has already been given, so going back to a tab shows it at
    // once instead of asking the server again: a page opened by a tap (dynamic) two minutes, a page
    // fetched ahead whole (static: the bottom bar's, lib/prefetch-pages.ts) five. The numbers on a page
    // are not held by this: each page refreshes its own data when it is older than 30 s
    // (app/providers.tsx), and saving a change drops every kept page (router.refresh()).
    staleTimes: { dynamic: 120, static: 300 },
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'date-fns',
    ],
  },
async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      { source: '/:path*', missing: [IMS_HOST], headers: [permissions(false)] },
      { source: '/:path*', has: [IMS_HOST], headers: [permissions(true)] },
      // the dashboard's Stock tab (FloorBeat IMS inside the dashboard, middleware.ts isImsTabPath): the camera too.
      // Later rules win for the same header, so these replace the "no camera" above on these addresses only.
      ...IMS_TAB_PATHS.map((source) => ({ source, headers: [permissions(true)] })),
    ];
  },
};

export default nextConfig;
