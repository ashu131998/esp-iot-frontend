import { describe, expect, it } from 'vitest';

import { forgotPasswordPathFor, newPasswordProblem, resetLinkMessage, signInPathFor } from '@/lib/auth-reset';

describe('signInPathFor / forgotPasswordPathFor', () => {
  it('send factory accounts to their factory pages', () => {
    expect(signInPathFor('mill-01')).toBe('/f/mill-01/login');
    expect(forgotPasswordPathFor('mill-01')).toBe('/f/mill-01/forgot-password');
  });
  it('send staff (no factory) to the internal console', () => {
    expect(signInPathFor(null)).toBe('/internal/login');
    expect(signInPathFor(undefined)).toBe('/internal/login');
    expect(forgotPasswordPathFor(null)).toBe('/internal/forgot-password');
  });
  it('never builds a path from a factory id that is not one', () => {
    expect(signInPathFor('../etc')).toBe('/internal/login');
    expect(signInPathFor('a b')).toBe('/internal/login');
    expect(signInPathFor('')).toBe('/internal/login');
  });
});

describe('resetLinkMessage', () => {
  it('explains each reason', () => {
    expect(resetLinkMessage('expired')).toContain('expired');
    expect(resetLinkMessage('used')).toContain('already used');
    expect(resetLinkMessage('invalid')).toContain('not valid');
    expect(resetLinkMessage(undefined)).toContain('not valid');
  });
});

describe('newPasswordProblem', () => {
  it('wants 8 to 128 characters, typed twice the same', () => {
    expect(newPasswordProblem('short', 'short')).toBe('Use at least 8 characters.');
    expect(newPasswordProblem('x'.repeat(129), 'x'.repeat(129))).toBe('Use at most 128 characters.');
    expect(newPasswordProblem('longenough', 'different')).toBe('The two passwords do not match.');
    expect(newPasswordProblem('longenough', 'longenough')).toBe(null);
  });
});
