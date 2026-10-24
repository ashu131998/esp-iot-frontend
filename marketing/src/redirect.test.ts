import { describe, expect, it } from 'vitest';

import { factoryLoginUrl, readCookie, signedInHome } from './redirect';

const origins = {
  APP_ORIGIN: 'https://app.floorbeat.in',
  STAFF_ORIGIN: 'https://ops.floorbeat.in',
};

describe('signedInHome', () => {
  it('returns null for visitors without the hint cookie', () => {
    expect(signedInHome(null, origins)).toBeNull();
    expect(signedInHome('other=1', origins)).toBeNull();
  });

  it('sends factory users to their dashboard on the app host', () => {
    expect(signedInHome('a=1; fb_home=%2Ffactories%2Ffactory-a', origins)).toBe(
      'https://app.floorbeat.in/factories/factory-a',
    );
    expect(signedInHome('fb_home=/factories/f_2', origins)).toBe(
      'https://app.floorbeat.in/factories/f_2',
    );
  });

  it('sends staff to the ops host', () => {
    expect(signedInHome('fb_home=/internal', origins)).toBe('https://ops.floorbeat.in/internal');
  });

  it('ignores values that could redirect elsewhere', () => {
    for (const bad of [
      '//evil.com',
      'https://evil.com',
      '/factories/../admin',
      '/factories/a/b',
      '/internal/users',
      '%E0%A4%A',
    ]) {
      expect(signedInHome(`fb_home=${bad}`, origins)).toBeNull();
    }
  });
});

describe('factoryLoginUrl', () => {
  it('builds the factory login URL on the app host', () => {
    expect(factoryLoginUrl(' factory-a ', origins)).toBe(
      'https://app.floorbeat.in/f/factory-a/login',
    );
  });

  it('rejects empty or unsafe ids', () => {
    for (const bad of [null, '', '../x', 'a/b', 'a b', '//evil.com']) {
      expect(factoryLoginUrl(bad, origins)).toBeNull();
    }
  });
});

describe('readCookie', () => {
  it('matches the exact cookie name', () => {
    expect(readCookie('xfb_home=/internal; fb_home=/factories/a', 'fb_home')).toBe(
      '/factories/a',
    );
  });
});
