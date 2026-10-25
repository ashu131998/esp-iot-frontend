import { describe, expect, it } from 'vitest';

import { RESTORE_RETRY_MS, loginRedirectPath, noteRestore, safeNextPath, shouldTryRestore } from '@/lib/auth-redirect';

describe('safeNextPath: only a page inside this app', () => {
  it('keeps app paths, with their query', () => {
    expect(safeNextPath('/factories/factory-01/status-timeline')).toBe('/factories/factory-01/status-timeline');
    expect(safeNextPath('/factories/f1/shift-reports?tab=recipients')).toBe('/factories/f1/shift-reports?tab=recipients');
  });

  it('refuses other sites, however they are written', () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example', 'javascript:alert(1)', ' //evil.example']) {
      expect(safeNextPath(next)).toBeNull();
    }
  });

  it('refuses login pages (no loops), control characters and nothing', () => {
    for (const next of ['/f/f1/login', '/f/f1/login?next=/x', '/f/f1/signup', '/internal/login', '/factories/f1\n/x', '', null, undefined]) {
      expect(safeNextPath(next)).toBeNull();
    }
  });
});

describe('loginRedirectPath: the login page that comes back to the page asked for', () => {
  it('carries the page and its query in ?next=', () => {
    expect(loginRedirectPath('factory-01', '/factories/factory-01/status-timeline', '?line_id=l1'))
      .toBe('/f/factory-01/login?next=%2Ffactories%2Ffactory-01%2Fstatus-timeline%3Fline_id%3Dl1');
  });

  it('no next for a path that is not safe to come back to', () => {
    expect(loginRedirectPath('f1', '/f/f1/login')).toBe('/f/f1/login');
  });
});

describe('silent sign-in loop guard', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('tries, then not again for a moment if it came straight back', () => {
    const s = store();
    expect(shouldTryRestore(s, 1_000_000)).toBe(true);
    noteRestore(s, 1_000_000);
    expect(shouldTryRestore(s, 1_000_000 + 5_000)).toBe(false);
    expect(shouldTryRestore(s, 1_000_000 + RESTORE_RETRY_MS)).toBe(true);
  });

  it('no storage (private mode): just tries', () => {
    expect(shouldTryRestore(null)).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldTryRestore(broken)).toBe(true);
    expect(() => noteRestore(broken)).not.toThrow();
  });
});
