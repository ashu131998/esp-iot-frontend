import type { NextConfig } from 'next';

// Baseline security headers (defense-in-depth). The per-request, nonce-based
// Content-Security-Policy is set in src/middleware.ts; these static headers also
// cover /api routes and static assets that middleware does not run on.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

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
    ];
  },
};

export default nextConfig;
