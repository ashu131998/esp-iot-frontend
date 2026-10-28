import { describe, expect, it } from 'vitest';

import { FACTORY_PAGES, factoryTabs } from '@/lib/display';
import { BOTTOM_BAR_SIZE, bottomBarTabs, shortLabel } from '@/lib/mobile-nav';

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

describe('shortLabel', () => {
  it('shortens the names too long for a bar slot', () => {
    expect(shortLabel({ slug: 'status-timeline', label: 'Status Timeline' })).toBe('Timeline');
    expect(shortLabel({ slug: 'shift-reports', label: 'Shift reports' })).toBe('Reports');
    expect(shortLabel({ slug: 'alerts', label: 'Alerts' })).toBe('Alerts');
  });

  it('keeps every bar label within about 12 characters', () => {
    for (const p of FACTORY_PAGES) expect(shortLabel(p).length).toBeLessThanOrEqual(12);
  });
});
