import { describe, expect, it } from 'vitest';

import { FACTORY_PAGES, OFF_BAR_PAGES, factoryTabs } from '@/lib/display';
import { BOTTOM_BAR_FULL, BOTTOM_BAR_SIZE, barPages, barPatch, bottomBarTabs, moreTabs, shortLabel } from '@/lib/mobile-nav';

const tab = (slug: string) => ({ slug, label: slug, href: `/factories/f1/${slug}` });
const slugs = (tabs: Array<{ slug: string }>) => tabs.map((t) => t.slug);

describe('bottomBarTabs', () => {
  it('puts overview, alerts, timeline and availability on the bar', () => {
    const all = FACTORY_PAGES.map((p) => tab(p.slug));
    expect(slugs(bottomBarTabs(all))).toEqual(['overview', 'alerts', 'status-timeline', 'availability']);
  });

  it('skips pages switched off for the factory and fills up in menu order', () => {
    const tabs = ['overview', 'status-timeline', 'energy', 'production', 'team'].map(tab);
    expect(slugs(bottomBarTabs(tabs))).toEqual(['overview', 'status-timeline', 'energy', 'production']);
  });

  it('shows fewer when the factory has fewer pages', () => {
    expect(slugs(bottomBarTabs(['overview', 'team'].map(tab)))).toEqual(['overview', 'team']);
    expect(bottomBarTabs([])).toEqual([]);
  });

  it('never holds more than its size, nor the same page twice', () => {
    const bar = bottomBarTabs(factoryTabs('f1', null));
    expect(bar.length).toBe(BOTTOM_BAR_SIZE);
    expect(new Set(slugs(bar)).size).toBe(bar.length);
  });
});

describe('moreTabs', () => {
  it('holds every page that is not on the bar, in menu order, and nothing twice', () => {
    const all = factoryTabs('f1', null);
    const more = moreTabs(all);
    expect(slugs(more)).not.toContain('overview');
    expect(slugs(more)).not.toContain('alerts');
    expect(slugs(more)[0]).toBe('results');
    expect(slugs(more).length + bottomBarTabs(all).length).toBe(all.length);
    expect(slugs([...bottomBarTabs(all), ...more]).sort()).toEqual(slugs(all).sort());
  });

  it('is empty when the bar holds every page', () => {
    expect(moreTabs(['overview', 'team'].map(tab))).toEqual([]);
  });
});

describe('the bar our staff chose for a factory (its display\'s bar.<page> switches)', () => {
  const pages = ['overview', 'results', 'status-timeline', 'alerts', 'energy', 'team', 'support'].map(tab);
  const bar = (...on: string[]) => Object.fromEntries(pages.map((p) => [`bar.${p.slug}`, on.includes(p.slug)]));

  it('exactly the pages they put on it, the main ones first, the rest behind More', () => {
    const display = bar('support', 'results', 'overview');
    expect(slugs(bottomBarTabs(pages, display))).toEqual(['overview', 'results', 'support']);
    expect(slugs(moreTabs(pages, display))).toEqual(['status-timeline', 'alerts', 'energy', 'team']);
  });

  it('four fit beside More: a fifth waits behind it', () => {
    const display = bar('overview', 'results', 'alerts', 'energy', 'support');
    expect(slugs(barPages(pages, display))).toEqual(['overview', 'alerts', 'results', 'energy', 'support']);
    expect(slugs(bottomBarTabs(pages, display))).toEqual(['overview', 'alerts', 'results', 'energy']);
    expect(slugs(moreTabs(pages, display))).toContain('support');
    expect(BOTTOM_BAR_SIZE).toBe(4);
  });

  it('every page of the factory on the bar, five or fewer: no More', () => {
    const five = ['overview', 'alerts', 'results', 'team', 'support'].map(tab);
    const display = Object.fromEntries(five.map((p) => [`bar.${p.slug}`, true]));
    expect(slugs(bottomBarTabs(five, display))).toEqual(['overview', 'alerts', 'results', 'team', 'support']);
    expect(moreTabs(five, display)).toEqual([]);
    expect(BOTTOM_BAR_FULL).toBe(5);
    const six = [...five, tab('energy')];
    const all = Object.fromEntries(six.map((p) => [`bar.${p.slug}`, true]));
    expect(bottomBarTabs(six, all)).toHaveLength(4);   // six do not fit: four and More
    expect(moreTabs(six, all)).toHaveLength(2);
  });

  it('none chosen: everything behind More; a page that is off for the person is not on the bar', () => {
    expect(bottomBarTabs(pages, bar())).toEqual([]);
    expect(moreTabs(pages, bar())).toHaveLength(pages.length);
    const withoutAlerts = pages.filter((p) => p.slug !== 'alerts');
    expect(slugs(bottomBarTabs(withoutAlerts, bar('overview', 'alerts')))).toEqual(['overview']);
  });

  it('a server from before the switches says nothing: the first four, as before', () => {
    expect(slugs(bottomBarTabs(pages, { energy: true, 'overview.cards': false }))).toEqual(['overview', 'alerts', 'status-timeline', 'results']);
    expect(slugs(bottomBarTabs(pages, null))).toEqual(['overview', 'alerts', 'status-timeline', 'results']);
  });
});

describe('what the staff editor saves', () => {
  const all = FACTORY_PAGES.map((p) => tab(p.slug));
  const visible = all.filter((p) => !['compliance', 'cameras'].includes(p.slug));

  it('every page\'s place at once, with the one that changed', () => {
    const patch = barPatch(all, visible, null, { slug: 'support', on: true });
    // all but Alert settings, which the server has no bar switch for (it would refuse the whole save)
    expect(Object.keys(patch)).toEqual(all.filter((p) => p.slug !== 'alert-settings').map((p) => `bar.${p.slug}`));
    expect(Object.entries(patch).filter(([, on]) => on).map(([k]) => k)).toEqual(['bar.overview', 'bar.status-timeline', 'bar.availability', 'bar.alerts', 'bar.support']);
    expect(barPatch(all, visible, null, { slug: 'alerts', on: false })['bar.alerts']).toBe(false);
  });

  it('from a bar already chosen: as stored, a page that is off keeping its place', () => {
    const display = { 'bar.overview': true, 'bar.cameras': true, 'bar.results': false };
    const patch = barPatch(all, visible, display, { slug: 'results', on: true });
    expect(patch['bar.overview']).toBe(true);
    expect(patch['bar.cameras']).toBe(true);    // off for the factory now, on the bar once it is back
    expect(patch['bar.results']).toBe(true);
    expect(patch['bar.alerts']).toBe(false);
  });
});

describe('shortLabel', () => {
  it('shortens the names too long for a bar slot', () => {
    expect(shortLabel({ slug: 'status-timeline', label: 'Status Timeline' })).toBe('Timeline');
    expect(shortLabel({ slug: 'shift-reports', label: 'Shift reports' })).toBe('Reports');
    expect(shortLabel({ slug: 'alerts', label: 'Alerts' })).toBe('Alerts');
  });

  it('keeps every bar label within about 12 characters', () => {
    for (const p of FACTORY_PAGES.filter((page) => !OFF_BAR_PAGES.has(page.slug))) expect(shortLabel(p).length).toBeLessThanOrEqual(12);
  });
});

describe('Alert settings never sits on the bar (the server has no bar switch for it)', () => {
  const pages = ['overview', 'alert-settings', 'team'].map(tab);

  it('not by default, not when a switch names it: it is behind More', () => {
    expect(slugs(bottomBarTabs(pages, null))).toEqual(['overview', 'team']);
    expect(slugs(moreTabs(pages, null))).toEqual(['alert-settings']);
    const display = { 'bar.overview': true, 'bar.alert-settings': true, 'bar.team': true };
    expect(slugs(barPages(pages, display))).toEqual(['overview', 'team']);
    expect(slugs(moreTabs(pages, display))).toEqual(['alert-settings']);
  });

  it('the staff editor never sends its switch, even asked to', () => {
    const patch = barPatch(pages, pages, null, { slug: 'alert-settings', on: true });
    expect(patch).toEqual({ 'bar.overview': true, 'bar.team': true });
  });
});
