/**
 * Which dashboard pages, and parts of pages, a factory shows.
 *
 * Our staff switch them per factory in the internal console ("Pages &
 * sections"); factory users cannot. The backend resolves every page and section
 * of its catalog to on/off and sends it as `display` on the factory (see
 * query-api src/display.js). Section keys are `<page>.<section>`, e.g.
 * `production.chart`. A key the backend did not send is shown.
 *
 * Energy and Production switched off also hide their numbers on other pages
 * (overview, lines, machines); the API refuses their data then, so those views
 * must not request it — see offQuery.
 */

import type { EnergyResponse, ProductionResponse } from './types';

export type Display = Record<string, boolean>;

/** A page of the switch catalog, as the backend lists it for the internal console. */
export interface DisplayPage {
  key: string;
  label: string;
  /** Always on; only its sections switch (Overview). */
  fixed: boolean;
  default: boolean;
  sections: Array<{ key: string; label: string; default: boolean }>;
}

/**
 * Resolve stored switches against the catalog, as the backend does: fixed pages
 * on, unset keys at their default, keys the catalog no longer has dropped.
 */
export function resolveDisplay(
  pages: ReadonlyArray<DisplayPage>,
  features: Display | null | undefined,
): Display {
  const pick = (key: string, fallback: boolean) =>
    typeof features?.[key] === 'boolean' ? features[key] : fallback;
  const display: Display = {};
  for (const p of pages) {
    display[p.key] = p.fixed ? true : pick(p.key, p.default);
    for (const s of p.sections) display[s.key] = pick(s.key, s.default);
  }
  return display;
}

/** Shown unless the factory switched it off. */
export function isShown(display: Display | null | undefined, key: string): boolean {
  return display?.[key] !== false;
}

// Before the backend sent `display`, only these pages could be switched (via `features`).
const LEGACY_DEFAULTS: Display = { vibration: false, temperature: false, compliance: false };

/** A factory's display map, falling back to the older `features` flags. */
export function displayOf(
  factory: { display?: Display; features?: Display } | null | undefined,
): Display {
  if (factory?.display) return factory.display;
  return { ...LEGACY_DEFAULTS, ...(factory?.features ?? {}) };
}

/** Factory pages in menu order. Team sits before Compliance and is always shown. */
export const FACTORY_PAGES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'status-timeline', label: 'Status Timeline' },
  { slug: 'availability', label: 'Availability' },
  { slug: 'alerts', label: 'Alerts' },
  { slug: 'energy', label: 'Energy' },
  { slug: 'vibration', label: 'Vibration' },
  { slug: 'temperature', label: 'Temperature' },
  { slug: 'performance', label: 'Performance' },
  { slug: 'production', label: 'Production' },
  { slug: 'quality', label: 'Quality' },
  { slug: 'lines', label: 'Lines' },
  { slug: 'configuration', label: 'Configuration' },
  { slug: 'scheduling', label: 'Scheduling' },
  { slug: 'shift-reports', label: 'Shift reports' },
  { slug: 'sensor-mapping', label: 'Sensor mapping' },
  { slug: 'team', label: 'Team' },
  { slug: 'compliance', label: 'Compliance' },
];

/** The factory's menu: its pages that are switched on. */
export function factoryTabs(
  factoryId: string,
  display: Display | null | undefined,
): Array<{ slug: string; label: string; href: string }> {
  const base = `/factories/${factoryId}`;
  return FACTORY_PAGES.filter((p) => p.slug === 'team' || isShown(display, p.slug)).map((p) => ({
    slug: p.slug,
    label: p.label,
    href: p.slug === 'overview' ? base : `${base}/${p.slug}`,
  }));
}

/**
 * Query options standing in for a switched-off module's request: resolves to
 * `data` without calling the API, so a view keeps the same shape of results.
 */
export function offQuery<T>(name: string, data: T) {
  return {
    queryKey: [name, 'switched-off'],
    queryFn: () => Promise.resolve(data),
    staleTime: Infinity,
  };
}

/** Empty energy result for views where Energy is switched off. */
export function noEnergy(factoryId: string): EnergyResponse {
  return { factory_id: factoryId, from: '', to: '', total_energy_kwh: 0, machines: [] };
}

/** Empty production result for views where Production is switched off. */
export function noProduction(factoryId: string): ProductionResponse {
  return { factory_id: factoryId, from: '', to: '', total_units: 0, machines: [] };
}
