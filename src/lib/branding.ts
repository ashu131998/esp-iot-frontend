/**
 * Per-factory branding our staff set in the internal console (Pages &
 * branding): an accent colour and a logo, shown in that factory's dashboard
 * and on its sign-in page. The backend sends
 * `branding: { accent_color, logo_version }` on the factory (query-api
 * src/branding.js); the logo itself is served by /api/logo/<factoryId>.
 */

import type { CSSProperties } from 'react';

export interface FactoryBranding {
  /** `#rrggbb`, or null for the standard colour. */
  accent_color: string | null;
  /** Changes on every save; null when there is no logo. */
  logo_version: number | null;
}

/** The factory's logo URL, versioned so a new upload shows at once; null without a logo. */
export function logoUrl(
  factoryId: string,
  branding: FactoryBranding | null | undefined,
): string | null {
  if (!branding?.logo_version) return null;
  return `/api/logo/${encodeURIComponent(factoryId)}?v=${branding.logo_version}`;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#0f172a';

/** Text colour that stays readable on `hex`: white on dark colours, near-black on light ones. */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onWhite >= onDark ? LIGHT_TEXT : DARK_TEXT;
}

/** Theme variables that recolour the primary colour inside one factory; undefined to keep it. */
export function brandStyle(branding: FactoryBranding | null | undefined): CSSProperties | undefined {
  const color = branding?.accent_color;
  if (!color) return undefined;
  return { '--primary': color, '--primary-foreground': readableOn(color) } as CSSProperties;
}
