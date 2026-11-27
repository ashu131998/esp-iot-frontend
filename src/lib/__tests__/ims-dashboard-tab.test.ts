import { describe, expect, it } from 'vitest';

import { gu } from '@/lib/i18n/messages/gu';
import { hi } from '@/lib/i18n/messages/hi';
import { factoryTabs, pageOn } from '@/lib/display';
import { imsHref, imsScreenOf } from '@/lib/ims/tab';
import { barPatch, bottomBarTabs, moreTabs } from '@/lib/mobile-nav';

/** One app (Ashutosh 2026-11-27): FloorBeat IMS is the dashboard's Stock tab, switched on per factory by our staff. */
describe('the Stock tab in the dashboard', () => {
  it('is there only when our staff switched the IMS on: never by default, never on an older server', () => {
    expect(pageOn({ ims: true }, 'ims')).toBe(true);
    expect(pageOn({ ims: false }, 'ims')).toBe(false);
    expect(pageOn({}, 'ims')).toBe(false);
    expect(pageOn(null, 'ims')).toBe(false);
    // the other pages as before: on unless switched off
    expect(pageOn({}, 'energy')).toBe(true);
    expect(factoryTabs('f1', { ims: true }).find((t) => t.slug === 'ims')).toEqual({ slug: 'ims', label: 'Stock', href: '/factories/f1/ims' });
    expect(factoryTabs('f1', {}).some((t) => t.slug === 'ims')).toBe(false);
  });

  it('sits on the phone\'s bottom bar when our staff put it there (bar.ims), else behind More', () => {
    const display = { ims: true, 'bar.overview': true, 'bar.alerts': true, 'bar.ims': true };
    const menu = factoryTabs('f1', display);
    expect(bottomBarTabs(menu, display).map((t) => t.slug)).toEqual(['overview', 'alerts', 'ims']);
    const off = { ...display, 'bar.ims': false };
    expect(bottomBarTabs(menu, off).map((t) => t.slug)).not.toContain('ims');
    expect(moreTabs(menu, off).map((t) => t.slug)).toContain('ims');
    // the staff editor saves bar.ims with the rest
    expect(barPatch(menu, menu, display, { slug: 'ims', on: false })['bar.ims']).toBe(false);
  });

  it('links its screens under the tab\'s address, and plain on the IMS app\'s own address', () => {
    expect(imsHref('/ims', '/')).toBe('/ims');
    expect(imsHref('/ims', '/stock?row=3')).toBe('/ims/stock?row=3');
    expect(imsHref('/factories/f1/ims/', '/scan')).toBe('/factories/f1/ims/scan');
    expect(imsHref('', '/stock')).toBe('/stock');
    expect(imsHref('', '/')).toBe('/');
  });

  it('knows which of its screens is open', () => {
    expect(imsScreenOf('/ims', '/ims')).toBe('/');
    expect(imsScreenOf('/ims/scan', '/ims')).toBe('/scan');
    expect(imsScreenOf('/factories/f1/ims/stock', '/factories/f1/ims')).toBe('/stock');
    expect(imsScreenOf('/imsx', '/ims')).toBeNull();
    expect(imsScreenOf('/energy', '/ims')).toBeNull();
  });

  it('has its name in Hindi and Gujarati', () => {
    expect(hi.Stock).toBeTruthy();
    expect(gu.Stock).toBeTruthy();
  });
});
