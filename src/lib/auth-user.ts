import type { AuthUser } from '@/lib/auth-types';

/** The user in the API's answer to "who am I" ({ user } or the user itself), when it is one. */
export function userFromAnswer(answer: unknown): AuthUser | undefined {
  const body = answer as { user?: unknown } | null;
  const user = (body && typeof body === 'object' && 'user' in body ? body.user : body) as Partial<AuthUser> | null | undefined;
  return user && typeof user === 'object' && typeof user.role === 'string' && typeof user.user_id === 'string' ? (user as AuthUser) : undefined;
}
