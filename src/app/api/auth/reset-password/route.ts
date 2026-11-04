import type { NextRequest } from 'next/server';

import { csrfBootstrap, forwardPublicPost } from '../_public-proxy';

/** GET: a CSRF token for the reset page. POST: Fastify POST /v1/auth/reset-password. */
export async function GET(req: NextRequest) {
  return csrfBootstrap(req);
}

export async function POST(req: NextRequest) {
  return forwardPublicPost(req, '/v1/auth/reset-password', 'Could not set the password. Try again.');
}
