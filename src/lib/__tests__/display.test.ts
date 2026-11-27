import { describe, expect, it } from 'vitest';

import {
  FACTORY_PAGES,
  HELP_PAGES,
  MANAGE_PAGES,
  displayOf,
  factoryTabs,
  isShown,
  noEnergy,
  noProduction,
  offQuery,
  resolveDisplay,
  sidebarGroups,
  tabsFor,
  type DisplayPage,
} from '@/lib/display';

// who looks at the menu: a factory's admin, one of its workers, our staff
const ADMIN = { canWrite: true, staff: false };
const WORKER = { canWrite: false, staff: false };
const STAFF = { canWrite: true, staff: true };

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

  it('falls back to the older feature flags, the compliance page off unless set', () => {
    const d = displayOf({ features: { maintenance: false, energy: false } });
    expect(isShown(d, 'maintenance')).toBe(false);
    expect(isShown(d, 'compliance')).toBe(false);
    expect(isShown(d, 'energy')).toBe(false);
    expect(isShown(d, 'production')).toBe(true);
    expect(isShown(displayOf(undefined), 'maintenance')).toBe(true);
    expect(isShown(displayOf(undefined), 'compliance')).toBe(false);
    expect(isShown(displayOf(null), 'overview')).toBe(true);
  });
});

describe('factoryTabs', () => {
  it('lists every page in menu order when nothing is switched off, Team before Compliance, Support last', () => {
    const slugs = factoryTabs('f1', {}).map((t) => t.slug);
    // the Stock tab (the IMS) only when switched on
    expect(slugs).toEqual(FACTORY_PAGES.map((p) => p.slug).filter((s) => s !== 'ims'));
    expect(slugs.slice(-3)).toEqual(['team', 'compliance', 'support']);
  });

  it('the IMS is the Stock tab (one app, 2026-11-27), only when our staff switched it on', () => {
    expect(factoryTabs('f1', { ims: true }).map((t) => t.slug)).toContain('ims');
    expect(factoryTabs('f1', { ims: false }).map((t) => t.slug)).not.toContain('ims');
    expect(factoryTabs('f1', {}).map((t) => t.slug)).not.toContain('ims');
  });

  it('leaves out switched-off pages but always keeps Team and Support', () => {
    const slugs = factoryTabs('f1', { energy: false, compliance: false, team: false, support: false }).map((t) => t.slug);
    expect(slugs).not.toContain('energy');
    expect(slugs).not.toContain('compliance');
    expect(slugs).toContain('team');
    expect(slugs).toContain('support');
  });

  it('Support is for everyone of the factory', () => {
    const tabs = factoryTabs('f1', {});
    expect(tabsFor(tabs, WORKER).map((t) => t.slug)).toContain('support');
    expect(tabs.at(-1)).toEqual({ slug: 'support', label: 'Support', href: '/factories/f1/support' });
  });

  it('shows WiFi to everyone of the factory: workers connect boards there (the passwords stay with its admins)', () => {
    const tabs = factoryTabs('f1', {});
    expect(tabsFor(tabs, ADMIN).map((t) => t.slug)).toContain('wifi');
    expect(tabsFor(tabs, WORKER).map((t) => t.slug)).toContain('wifi');
  });

  it('the factory\'s people have no Alerts and no Stock tab: those are apps of their own on FloorBeat\'s home screen (2026-11-27)', () => {
    const tabs = factoryTabs('f1', { ims: true });
    for (const who of [ADMIN, WORKER]) {
      const slugs = tabsFor(tabs, who).map((t) => t.slug);
      expect(slugs).not.toContain('alerts');
      expect(slugs).not.toContain('ims');
    }
    // our staff keep both: how they see a factory's alerts and stock (they have no home screen of apps)
    const staff = tabsFor(tabs, STAFF).map((t) => t.slug);
    expect(staff).toContain('alerts');
    expect(staff).toContain('ims');
    expect(tabsFor(tabs, STAFF)).toHaveLength(tabs.length);
    // the rest is everyone's, admins' and workers' alike
    expect(tabsFor(tabs, WORKER).map((t) => t.slug)).toEqual(tabs.map((t) => t.slug).filter((s) => !['alerts', 'ims'].includes(s)));
    expect(tabsFor(tabs, ADMIN)).toEqual(tabsFor(tabs, WORKER));
  });

  it('no Alert settings in the dashboard: the factory\'s admins have them in the Alerts\' Settings (2026-11-27)', () => {
    expect(FACTORY_PAGES.map((p) => p.slug)).not.toContain('alert-settings');
    expect(factoryTabs('f1', { ims: true }).map((t) => t.slug)).not.toContain('alert-settings');
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

describe('sidebarGroups: what people read (Monitor), then what they set up (Manage)', () => {
  it('every factory page lands in exactly one group, in menu order', () => {
    const groups = sidebarGroups(FACTORY_PAGES);
    expect(groups.map((g) => g.key)).toEqual(['monitor', 'manage', 'help']);
    expect(groups[0].tabs.map((p) => p.slug)).toEqual([
      'overview', 'results', 'status-timeline', 'availability', 'alerts', 'energy', 'maintenance', 'cameras', 'performance', 'production', 'quality', 'ims',
    ]);
    expect(groups[1].tabs.map((p) => p.slug)).toEqual([
      'lines', 'configuration', 'scheduling', 'shift-reports', 'sensor-mapping', 'wifi', 'team', 'compliance',
    ]);
    expect(groups[2].tabs.map((p) => p.slug)).toEqual(['support']);
    expect(groups.flatMap((g) => g.tabs)).toHaveLength(FACTORY_PAGES.length);
  });

  it('names only pages that exist', () => {
    const slugs = FACTORY_PAGES.map((p) => p.slug);
    for (const slug of [...MANAGE_PAGES, ...HELP_PAGES]) expect(slugs).toContain(slug);
  });

  it('a group with nothing in it is left out', () => {
    expect(sidebarGroups([{ slug: 'overview' }, { slug: 'energy' }]).map((g) => g.key)).toEqual(['monitor']);
    expect(sidebarGroups([{ slug: 'team' }]).map((g) => g.key)).toEqual(['manage']);
    expect(sidebarGroups([{ slug: 'overview' }, { slug: 'support' }]).map((g) => g.key)).toEqual(['monitor', 'help']);
    expect(sidebarGroups([])).toEqual([]);
  });
});
