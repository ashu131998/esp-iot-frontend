import { describe, expect, it } from 'vitest';

import { factoryHrefFor, plainFactoryHref } from '@/lib/factory-links';

describe('plainFactoryHref: a factory page at its own address', () => {
  it('drops /factories/<id>; the dashboard is /', () => {
    expect(plainFactoryHref('/factories/factory-01')).toBe('/');
    expect(plainFactoryHref('/factories/factory-01/energy')).toBe('/energy');
    expect(plainFactoryHref('/factories/factory-01/machines/m-07')).toBe('/machines/m-07');
    expect(plainFactoryHref('/factories/factory-01/alerts?from=2026-11-01')).toBe('/alerts?from=2026-11-01');
    expect(plainFactoryHref('/factories/factory-01?tab=x')).toBe('/?tab=x');
  });

  it('leaves anything else as it is', () => {
    for (const href of ['/', '/internal', '/f/factory-01/login', 'https://floorbeat.in/', '/factories']) {
      expect(plainFactoryHref(href)).toBe(href);
    }
  });

  it("only at the factory's own address", () => {
    expect(factoryHrefFor(true)('/factories/factory-01/energy')).toBe('/energy');
    expect(factoryHrefFor(false)('/factories/factory-01/energy')).toBe('/factories/factory-01/energy');
  });
});
