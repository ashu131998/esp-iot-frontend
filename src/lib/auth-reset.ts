/**
 * Where the forgot-password / reset pages send people. Pure, so the routing is tested.
 * Staff accounts have no factory (factory_id null) and sign in at the internal console.
 */

const FACTORY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function factoryPathSegment(factoryId: string | null | undefined): string | null {
  return factoryId && FACTORY_ID_RE.test(factoryId) ? encodeURIComponent(factoryId) : null;
}

/** The sign-in page for an account: its factory's, or the staff console's. */
export function signInPathFor(factoryId: string | null | undefined): string {
  const f = factoryPathSegment(factoryId);
  return f ? `/f/${f}/login` : '/internal/login';
}

/** The forgot-password page for an account's factory, or the staff console's. */
export function forgotPasswordPathFor(factoryId: string | null | undefined): string {
  const f = factoryPathSegment(factoryId);
  return f ? `/f/${f}/forgot-password` : '/internal/forgot-password';
}

export type ResetLinkReason = 'expired' | 'invalid' | 'used';

/** What the reset page says about a link that no longer works (English keys for t()). */
export function resetLinkMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'expired':
      return 'This link has expired: it works for 30 minutes. Ask for a new one.';
    case 'used':
      return 'This link was already used. If you changed your password, sign in with it; otherwise ask for a new link.';
    default:
      return 'This link is not valid. Ask for a new one.';
  }
}

/** Client-side checks on a new password pair; null when fine, else the English message key. */
export function newPasswordProblem(password: string, repeat: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (password !== repeat) return 'The two passwords do not match.';
  return null;
}
