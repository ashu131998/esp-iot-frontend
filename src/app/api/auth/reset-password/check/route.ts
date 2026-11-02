import type { NextRequest } from 'next/server';

import { forwardPublicPost } from '../../_public-proxy';

/** POST: Fastify POST /v1/auth/reset-password/check → { valid, username?, factory_id?, reason? }. */
export async function POST(req: NextRequest) {
  return forwardPublicPost(req, '/v1/auth/reset-password/check', 'Could not check the link. Try again.');
}
