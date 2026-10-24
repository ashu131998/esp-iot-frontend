import { describe, expect, it } from 'vitest';

import { brandStyle, logoUrl, readableOn } from '@/lib/branding';

describe('logoUrl', () => {
  it('points at our logo route, versioned by the last save', () => {
    expect(logoUrl('factory-01', { accent_color: null, logo_version: 1761379200000 }))
      .toBe('/api/logo/factory-01?v=1761379200000');
  });

  it('encodes the factory id', () => {
    expect(logoUrl('a b', { accent_color: null, logo_version: 1 })).toBe('/api/logo/a%20b?v=1');
  });

  it('is null without a logo', () => {
    expect(logoUrl('factory-01', { accent_color: '#1a73e8', logo_version: null })).toBeNull();
    expect(logoUrl('factory-01', undefined)).toBeNull();
    expect(logoUrl('factory-01', null)).toBeNull();
  });
});

describe('readableOn', () => {
  it('uses white text on dark colours', () => {
    for (const c of ['#000000', '#1a73e8', '#2563eb', '#7c3aed', '#b91c1c']) expect(readableOn(c), c).toBe('#ffffff');
  });

  it('uses dark text on light colours', () => {
    for (const c of ['#ffffff', '#facc15', '#a3e635', '#67e8f9']) expect(readableOn(c), c).toBe('#0f172a');
  });
});

describe('brandStyle', () => {
  it('sets the primary colour and a readable text colour', () => {
    expect(brandStyle({ accent_color: '#facc15', logo_version: null })).toEqual({
      '--primary': '#facc15',
      '--primary-foreground': '#0f172a',
    });
  });

  it('keeps the standard theme without a colour', () => {
    expect(brandStyle({ accent_color: null, logo_version: 5 })).toBeUndefined();
    expect(brandStyle(undefined)).toBeUndefined();
  });
});
