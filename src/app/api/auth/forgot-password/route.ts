import type { NextRequest } from 'next/server';

import { csrfBootstrap, forwardPublicPost } from '../_public-proxy';

/** GET: a CSRF token for the form. POST: Fastify POST /v1/auth/forgot-password (always 200 there). */
export async function GET(req: NextRequest) {
  return csrfBootstrap(req);
}

export async function POST(req: NextRequest) {
  return forwardPublicPost(req, '/v1/auth/forgot-password', 'Could not send the link. Try again.');
}
