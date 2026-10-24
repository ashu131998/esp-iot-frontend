import { describe, expect, it } from 'vitest';

import { homePathFromAccessToken } from '@/lib/server/bff';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

describe('homePathFromAccessToken', () => {
  it('sends factory users to their factory dashboard', () => {
    expect(homePathFromAccessToken(fakeJwt({ role: 'admin', factory_id: 'factory-a' }))).toBe(
      '/factories/factory-a',
    );
    expect(
      homePathFromAccessToken(fakeJwt({ role: 'employee', factory_id: 'factory_b2' })),
    ).toBe('/factories/factory_b2');
  });

  it('sends staff to the internal console', () => {
    expect(homePathFromAccessToken(fakeJwt({ role: 'super_admin', factory_id: null }))).toBe(
      '/internal',
    );
    expect(homePathFromAccessToken(fakeJwt({ role: 'internal_viewer' }))).toBe('/internal');
  });

  it('rejects factory ids that could escape the path', () => {
    expect(
      homePathFromAccessToken(fakeJwt({ role: 'admin', factory_id: '../evil' })),
    ).toBeNull();
    expect(
      homePathFromAccessToken(fakeJwt({ role: 'admin', factory_id: 'a/b' })),
    ).toBeNull();
  });

  it('returns null for malformed tokens', () => {
    expect(homePathFromAccessToken('not-a-jwt')).toBeNull();
    expect(homePathFromAccessToken('a.%%%.c')).toBeNull();
    expect(homePathFromAccessToken(fakeJwt({ factory_id: null }))).toBeNull();
  });
});
