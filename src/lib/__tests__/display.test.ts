import { describe, expect, it } from 'vitest';

import {
  FACTORY_PAGES,
  displayOf,
  factoryTabs,
  isShown,
  noEnergy,
  noProduction,
  offQuery,
  resolveDisplay,
  tabsFor,
  type DisplayPage,
} from '@/lib/display';

const CATALOG: DisplayPage[] = [
  {
    key: 'overview', label: 'Overview', fixed: true, default: true,
    sections: [{ key: 'overview.cards', label: 'Summary cards', default: true }],
  },
  {
    key: 'production', label: 'Production', fixed: false, default: true,
    sections: [
      { key: 'production.chart', label: 'Graph', default: true },
      { key: 'production.table', label: 'Machine table', default: true },
    ],
  },
  { key: 'vibration', label: 'Vibration', fixed: false, default: false, sections: [] },
];

describe('isShown', () => {
  it('shows anything not switched off, including keys the backend did not send', () => {
    expect(isShown({ energy: true }, 'energy')).toBe(true);
    expect(isShown({ energy: false }, 'energy')).toBe(false);
    expect(isShown({}, 'production.chart')).toBe(true);
    expect(isShown(undefined, 'energy')).toBe(true);
    expect(isShown(null, 'energy')).toBe(true);
  });
});

describe('displayOf', () => {
  it('uses the resolved map the backend sends', () => {
    expect(displayOf({ display: { energy: false }, features: { energy: true } })).toEqual({ energy: false });
  });

  it('falls back to the older feature flags, sensor pages off unless set', () => {
    const d = displayOf({ features: { vibration: true, energy: false } });
    expect(isShown(d, 'vibration')).toBe(true);
    expect(isShown(d, 'temperature')).toBe(false);
    expect(isShown(d, 'compliance')).toBe(false);
    expect(isShown(d, 'energy')).toBe(false);
    expect(isShown(d, 'production')).toBe(true);
    expect(isShown(displayOf(undefined), 'temperature')).toBe(false);
    expect(isShown(displayOf(null), 'overview')).toBe(true);
  });
});

describe('factoryTabs', () => {
  it('lists every page in menu order when nothing is switched off, Team before Compliance', () => {
    const slugs = factoryTabs('f1', {}).map((t) => t.slug);
    expect(slugs).toEqual(FACTORY_PAGES.map((p) => p.slug));
    expect(slugs.slice(-2)).toEqual(['team', 'compliance']);
  });

  it('leaves out switched-off pages but always keeps Team', () => {
    const slugs = factoryTabs('f1', { energy: false, compliance: false, team: false }).map((t) => t.slug);
    expect(slugs).not.toContain('energy');
    expect(slugs).not.toContain('compliance');
    expect(slugs).toContain('team');
  });

  it('shows WiFi (it has the passwords) only to people who can change the factory', () => {
    const tabs = factoryTabs('f1', {});
    expect(tabsFor(tabs, true).map((t) => t.slug)).toContain('wifi');
    expect(tabsFor(tabs, false).map((t) => t.slug)).not.toContain('wifi');
    expect(tabsFor(tabs, false)).toHaveLength(tabs.length - 1);
  });

  it('links Overview to the factory root and other pages below it', () => {
    const tabs = factoryTabs('factory-01', {});
    expect(tabs[0]).toEqual({ slug: 'overview', label: 'Overview', href: '/factories/factory-01' });
    expect(tabs.find((t) => t.slug === 'shift-reports')).toEqual({
      slug: 'shift-reports', label: 'Shift reports', href: '/factories/factory-01/shift-reports',
    });
  });
});

describe('resolveDisplay (same rules as the backend)', () => {
  it('gives every page and section its default', () => {
    expect(resolveDisplay(CATALOG, {})).toEqual({
      overview: true, 'overview.cards': true,
      production: true, 'production.chart': true, 'production.table': true,
      vibration: false,
    });
  });

  it('applies switches, keeps fixed pages on, drops unknown keys and non-boolean values', () => {
    const d = resolveDisplay(CATALOG, {
      overview: false, 'overview.cards': false, 'production.chart': false, vibration: true,
      bogus: true, production: 'off' as unknown as boolean,
    });
    expect(d.overview).toBe(true);
    expect(d['overview.cards']).toBe(false);
    expect(d['production.chart']).toBe(false);
    expect(d.production).toBe(true);
    expect(d.vibration).toBe(true);
    expect('bogus' in d).toBe(false);
  });

  it('treats missing switches as nothing switched', () => {
    expect(resolveDisplay(CATALOG, undefined)).toEqual(resolveDisplay(CATALOG, {}));
    expect(resolveDisplay(CATALOG, null)).toEqual(resolveDisplay(CATALOG, {}));
  });
});

describe('switched-off module stand-ins', () => {
  it('offQuery resolves locally to the given data and never goes stale', async () => {
    const q = offQuery('energy', noEnergy('f1'));
    expect(q.queryKey).toEqual(['energy', 'switched-off']);
    expect(q.staleTime).toBe(Infinity);
    await expect(q.queryFn()).resolves.toEqual({
      factory_id: 'f1', from: '', to: '', total_energy_kwh: 0, machines: [],
    });
  });

  it('empty production keeps the response shape', () => {
    expect(noProduction('f1')).toEqual({ factory_id: 'f1', from: '', to: '', total_units: 0, machines: [] });
  });
});
