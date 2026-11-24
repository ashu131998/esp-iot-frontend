import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { ACCESS_COOKIE, REFRESH_COOKIE, type AuthUser } from '@/lib/auth-types';
import { userFromAnswer } from '@/lib/auth-user';
import { internalApiFetch } from '@/lib/internal-api-fetch';

/** The API is next to this server: an answer that takes longer than this is left to the browser to ask for. */
const ASK_MS = 2500;

/**
 * Who is signed in, for the page being drawn, so the page arrives knowing it:
 *   - the user;
 *   - null: nobody (no session cookie at all);
 *   - undefined: it could not be told here (a session that needs renewing, the API not answering in
 *     time). The browser then asks /api/auth/me, as every page used to on every start.
 *
 * Before this, every start of the app drew the page, then asked who was signed in (0.4 to 0.8 s on a
 * phone, measured 2026-11-24), and only then showed what depends on the answer: the buttons an admin
 * gets, the name in the menu. They popped in and pushed the page about.
 */
export const sessionUser = cache(async (): Promise<AuthUser | null | undefined> => {
  const jar = await cookies();
  if (!jar.get(ACCESS_COOKIE)?.value) return jar.get(REFRESH_COOKIE)?.value ? undefined : null;
  try {
    const res = await internalApiFetch('/v1/auth/me', { timeoutMs: ASK_MS });
    if (!res.ok) return undefined;
    return userFromAnswer(await res.json());
  } catch {
    return undefined;
  }
});
