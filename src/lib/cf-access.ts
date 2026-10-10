import type { NextRequest } from 'next/server';

/**
 * When INTERNAL_REQUIRE_CF_ACCESS=true (production), staff routes expect
 * Cloudflare Access to have authenticated the browser. CF sets
 * cf-access-authenticated-user-email on the origin request.
 */
export function cfAccessOk(req: NextRequest): boolean {
  if (process.env.INTERNAL_REQUIRE_CF_ACCESS !== 'true') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  const email = req.headers.get('cf-access-authenticated-user-email');
  return Boolean(email?.includes('@'));
}

export function cfAccessBlockMessage(): string {
  return 'This staff area requires Cloudflare Access. Sign in through your team Access application.';
}
