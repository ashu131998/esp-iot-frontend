import { describe, expect, it } from 'vitest';

import { alwaysShown, factoryLoginUrl, factoryOrigin, forwardTarget, lookupFactoryId, readCookie, signedInHome } from './redirect';

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe('lookupFactoryId', () => {
  const api = 'https://api.floorbeat.in';

  it('gives the real ID of an existing factory, also for one typed in other letters', async () => {
    expect(await lookupFactoryId('factory-01', api, respond(200, { factory_id: 'factory-01', name: 'Mill' }))).toBe('factory-01');
    expect(await lookupFactoryId('Factory-01', api, respond(200, { factory_id: 'factory-01', name: 'Mill' }))).toBe('factory-01');
  });

  it('keeps the typed ID when an older API sends no usable ID', async () => {
    expect(await lookupFactoryId('factory-01', api, respond(200, { name: 'Mill' }))).toBe('factory-01');
    expect(await lookupFactoryId('factory-01', api, respond(200, { factory_id: '../x' }))).toBe('factory-01');
  });

  it('is false only for the API\'s factory-not-found answer', async () => {
    expect(await lookupFactoryId('nope', api, respond(404, { error: 'Factory not found' }))).toBe(false);
  });

  it('is null when the API cannot answer, so visitors still reach sign-in', async () => {
    expect(await lookupFactoryId('factory-01', api, respond(404, { error: 'Not Found', statusCode: 404 }))).toBeNull();
    expect(await lookupFactoryId('factory-01', api, respond(502, {}))).toBeNull();
    const failing = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await lookupFactoryId('factory-01', api, failing)).toBeNull();
  });
});

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

describe('alwaysShown', () => {
  it('keeps the ROI calculator and partners page open to signed-in visitors', () => {
    for (const p of ['/roi', '/roi.html', '/roi/', '/partners', '/partners.html', '/privacy', '/terms', '/terms.html']) expect(alwaysShown(p)).toBe(true);
  });
  it('sends signed-in visitors on from every other page', () => {
    for (const p of ['/', '/index.html', '/login', '/roi-calc.js', '/partnersx']) expect(alwaysShown(p)).toBe(false);
  });
});

describe('forwardTarget (addresses that lost their subdomain)', () => {
  const o = { APP_ORIGIN: 'https://app.floorbeat.in', STAFF_ORIGIN: 'https://ops.floorbeat.in' };

  it('sends factory sign-in and dashboard pages to the app, query and all', () => {
    expect(forwardTarget('/f/factory-01/login', '', o)).toBe('https://app.floorbeat.in/f/factory-01/login');
    expect(forwardTarget('/f/factory-01', '?next=%2Ff%2Ffactory-01', o)).toBe('https://app.floorbeat.in/f/factory-01?next=%2Ff%2Ffactory-01');
    expect(forwardTarget('/f/Factory-01/forgot-password', '', o)).toBe('https://app.floorbeat.in/f/Factory-01/forgot-password');
    expect(forwardTarget('/factories/factory-01/results', '?month=2026-10', o)).toBe('https://app.floorbeat.in/factories/factory-01/results?month=2026-10');
    expect(forwardTarget('/factories/factory-01/machines/loom-07/', '', o)).toBe('https://app.floorbeat.in/factories/factory-01/machines/loom-07/');
  });

  it('sends password-reset links to the app with their token', () => {
    expect(forwardTarget('/reset-password', '?token=a.b-c_d&factory=mill-01', o)).toBe('https://app.floorbeat.in/reset-password?token=a.b-c_d&factory=mill-01');
  });

  it('sends staff pages to the staff console', () => {
    expect(forwardTarget('/internal', '', o)).toBe('https://ops.floorbeat.in/internal');
    expect(forwardTarget('/internal/login', '', o)).toBe('https://ops.floorbeat.in/internal/login');
  });

  it('leaves the website\'s own pages alone', () => {
    for (const p of ['/', '/login', '/login/staff', '/roi', '/partners', '/styles.css', '/f', '/factories', '/fx/a']) {
      expect(forwardTarget(p, '', o)).toBeNull();
    }
  });

  it('never builds a strange address', () => {
    for (const p of ['/f//evil.com', '/f/../x', '/f/a b', '/f/a/../../x', '/factories/a.b', '/internal/..']) {
      expect(forwardTarget(p, '', o)).toBeNull();
    }
    expect(forwardTarget(`/f/${'a'.repeat(65)}`, '', o)).toBeNull();
  });
});

describe('production: each factory has its own address (<id>.floorbeat.in)', () => {
  const prod = { APP_ORIGIN: 'https://app.floorbeat.in', STAFF_ORIGIN: 'https://ops.floorbeat.in', FACTORY_HOST_SUFFIX: '.floorbeat.in' };

  it('a factory\'s origin; an ID that cannot be an address keeps the app', () => {
    expect(factoryOrigin('factory-01', prod)).toBe('https://factory-01.floorbeat.in');
    expect(factoryOrigin('Factory-01', prod)).toBe('https://factory-01.floorbeat.in');
    expect(factoryOrigin('f_2', prod)).toBe('https://app.floorbeat.in');
    expect(factoryOrigin('factory-01', origins)).toBe('https://app.floorbeat.in');   // stage, dev: as before
  });

  it('the login form, the signed-in visitor and lost-subdomain links go to the factory\'s plain address', () => {
    expect(factoryLoginUrl('factory-01', prod)).toBe('https://factory-01.floorbeat.in/login');
    expect(signedInHome('fb_home=/factories/factory-01', prod)).toBe('https://factory-01.floorbeat.in/');
    expect(forwardTarget('/f/factory-01/login', '', prod)).toBe('https://factory-01.floorbeat.in/login');
    expect(forwardTarget('/f/factory-01', '?next=%2Fenergy', prod)).toBe('https://factory-01.floorbeat.in/?next=%2Fenergy');
    expect(forwardTarget('/factories/factory-01/results', '?month=2026-10', prod)).toBe('https://factory-01.floorbeat.in/results?month=2026-10');
  });

  it('reset links: a factory account\'s to its address, a staff account\'s to the staff console', () => {
    expect(forwardTarget('/reset-password', '?token=t&factory=factory-01', prod)).toBe('https://factory-01.floorbeat.in/reset-password?token=t&factory=factory-01');
    expect(forwardTarget('/reset-password', '?token=t', prod)).toBe('https://ops.floorbeat.in/reset-password?token=t');
    expect(forwardTarget('/reset-password', '?token=t', origins)).toBe('https://app.floorbeat.in/reset-password?token=t');   // stage, dev
  });
});

describe('stage and dev: their factories have addresses too (<id>.stage.floorbeat.in, <id>.dev.floorbeat.in)', () => {
  const stage = { APP_ORIGIN: 'https://stage-app.floorbeat.in', STAFF_ORIGIN: 'https://stage-ops.floorbeat.in', FACTORY_HOST_SUFFIX: '.stage.floorbeat.in' };

  it('the login form and lost-subdomain links go to the stage factory; a staff reset to stage-ops', () => {
    expect(factoryLoginUrl('factory-01', stage)).toBe('https://factory-01.stage.floorbeat.in/login');
    expect(forwardTarget('/f/factory-01/login', '', stage)).toBe('https://factory-01.stage.floorbeat.in/login');
    expect(forwardTarget('/reset-password', '?token=t', stage)).toBe('https://stage-ops.floorbeat.in/reset-password?token=t');
  });
});

