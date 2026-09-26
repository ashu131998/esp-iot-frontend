import { describe, it, expect } from 'vitest';

import {
  FEATURE_DEFAULTS,
  filterTabsByFeatures,
  isFeatureEnabled,
  isFeatureSlug,
} from '@/lib/factory-features';
import { factoryTabs } from '@/lib/factory-config';

describe('isFeatureSlug', () => {
  it('recognises gated slugs', () => {
    expect(isFeatureSlug('energy')).toBe(true);
    expect(isFeatureSlug('vibration')).toBe(true);
    expect(isFeatureSlug('temperature')).toBe(true);
  });

  it('rejects non-gated slugs', () => {
    expect(isFeatureSlug('overview')).toBe(false);
    expect(isFeatureSlug('alerts')).toBe(false);
  });
});

describe('isFeatureEnabled — defaults when unset', () => {
  it('energy defaults on', () => {
    expect(isFeatureEnabled(undefined, 'energy')).toBe(true);
    expect(isFeatureEnabled({}, 'energy')).toBe(true);
  });

  it('vibration & temperature default off', () => {
    expect(isFeatureEnabled(undefined, 'vibration')).toBe(false);
    expect(isFeatureEnabled({}, 'temperature')).toBe(false);
  });

  it('matches the FEATURE_DEFAULTS table', () => {
    for (const [slug, expected] of Object.entries(FEATURE_DEFAULTS)) {
      expect(isFeatureEnabled({}, slug)).toBe(expected);
    }
  });
});

describe('isFeatureEnabled — explicit flags override defaults', () => {
  it('can disable energy', () => {
    expect(isFeatureEnabled({ energy: false }, 'energy')).toBe(false);
  });

  it('can enable vibration & temperature', () => {
    expect(isFeatureEnabled({ vibration: true }, 'vibration')).toBe(true);
    expect(isFeatureEnabled({ temperature: true }, 'temperature')).toBe(true);
  });

  it('non-gated tabs are always enabled regardless of flags', () => {
    expect(isFeatureEnabled({}, 'overview')).toBe(true);
    expect(isFeatureEnabled({ energy: false }, 'production')).toBe(true);
  });
});

describe('filterTabsByFeatures', () => {
  const tabs = [
    { slug: 'overview', label: 'Overview', href: '/o' },
    { slug: 'energy', label: 'Energy', href: '/e' },
    { slug: 'vibration', label: 'Vibration', href: '/v' },
    { slug: 'temperature', label: 'Temperature', href: '/t' },
    { slug: 'alerts', label: 'Alerts', href: '/a' },
  ];

  it('with no features: keeps energy + non-gated, drops vibration/temperature', () => {
    const out = filterTabsByFeatures(tabs, undefined).map((t) => t.slug);
    expect(out).toEqual(['overview', 'energy', 'alerts']);
  });

  it('enabling vibration surfaces its tab', () => {
    const out = filterTabsByFeatures(tabs, { vibration: true }).map((t) => t.slug);
    expect(out).toContain('vibration');
    expect(out).not.toContain('temperature');
  });

  it('disabling energy removes its tab', () => {
    const out = filterTabsByFeatures(tabs, { energy: false }).map((t) => t.slug);
    expect(out).not.toContain('energy');
    expect(out).toContain('overview');
  });

  it('all sensors on keeps every tab', () => {
    const out = filterTabsByFeatures(tabs, {
      energy: true,
      vibration: true,
      temperature: true,
    });
    expect(out).toHaveLength(tabs.length);
  });
});

describe('factoryTabs candidate list includes gated tabs', () => {
  it('offers energy, vibration, temperature as candidates (pre-filter)', () => {
    const slugs = factoryTabs('factory-pune-01').map((t) => t.slug);
    expect(slugs).toContain('energy');
    expect(slugs).toContain('vibration');
    expect(slugs).toContain('temperature');
  });

  it('gated candidates become the real nav only after feature filtering', () => {
    const candidates = factoryTabs('factory-pune-01');
    const visible = filterTabsByFeatures(candidates, {}).map((t) => t.slug);
    expect(visible).toContain('energy');
    expect(visible).not.toContain('vibration');
    expect(visible).not.toContain('temperature');
  });
});
