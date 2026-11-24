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

import type { EnergyResponse, PerformanceResponse, ProductionResponse } from './types';

export type Display = Record<string, boolean>;

/** A page of the switch catalog, as the backend lists it for the internal console. */
export interface DisplayPage {
  key: string;
  label: string;
  /** Always on; only its sections switch (Overview). */
  fixed: boolean;
  default: boolean;
  sections: Array<{ key: string; label: string; default: boolean; description?: string }>;
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

// Before the backend sent `display`, only these pages could be switched (via `features`); pages added
// since are off until the backend says so.
const LEGACY_DEFAULTS: Display = { compliance: false, cameras: false };

/** A factory's display map, falling back to the older `features` flags. */
export function displayOf(
  factory: { display?: Display; features?: Display } | null | undefined,
): Display {
  if (factory?.display) return factory.display;
  return { ...LEGACY_DEFAULTS, ...(factory?.features ?? {}) };
}

/** Factory pages in menu order. Team (before Compliance) and Support (last) are always shown. */
export const FACTORY_PAGES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'results', label: 'Results' },
  { slug: 'status-timeline', label: 'Status Timeline' },
  { slug: 'availability', label: 'Availability' },
  { slug: 'alerts', label: 'Alerts' },
  { slug: 'energy', label: 'Energy' },
  { slug: 'maintenance', label: 'Maintenance' },
  { slug: 'cameras', label: 'Cameras' },
  { slug: 'performance', label: 'Performance' },
  { slug: 'production', label: 'Production' },
  { slug: 'quality', label: 'Quality' },
  { slug: 'lines', label: 'Lines' },
  { slug: 'configuration', label: 'Configuration' },
  { slug: 'scheduling', label: 'Scheduling' },
  { slug: 'shift-reports', label: 'Shift reports' },
  { slug: 'sensor-mapping', label: 'Sensor mapping' },
  { slug: 'wifi', label: 'WiFi' },
  { slug: 'team', label: 'Team' },
  { slug: 'compliance', label: 'Compliance' },
  { slug: 'support', label: 'Support' },
];

/** Pages every factory has, whatever our staff switch: its people and asking us for help. */
const ALWAYS_SHOWN: ReadonlySet<string> = new Set(['team', 'support']);

/**
 * Pages only for people who can change the factory (its admins and our super admin). None since 2026-11: the
 * WiFi page is for everyone of the factory (workers connect boards; the passwords stay with its admins).
 */
const ADMIN_PAGES: readonly string[] = [];

/** The menu as this person sees it: admin-only pages left out for everyone else. */
export function tabsFor<T extends { slug: string }>(tabs: readonly T[], canWrite: boolean): T[] {
  return tabs.filter((t) => canWrite || !ADMIN_PAGES.includes(t.slug));
}

/** The pages people set the factory up with: the sidebar lists them under Manage, the rest under Monitor. */
export const MANAGE_PAGES: ReadonlySet<string> = new Set([
  'lines', 'configuration', 'scheduling', 'shift-reports', 'sensor-mapping', 'wifi', 'team', 'compliance',
]);

/** The pages for getting help: the sidebar lists them last, under Help. */
export const HELP_PAGES: ReadonlySet<string> = new Set(['support']);

export type SidebarGroupKey = 'monitor' | 'manage' | 'help';

/**
 * The sidebar's groups in menu order: what people read (Monitor), what they set up (Manage), then
 * asking us for help (Help); an empty one left out.
 */
export function sidebarGroups<T extends { slug: string }>(tabs: readonly T[]): Array<{ key: SidebarGroupKey; tabs: T[] }> {
  const groups: Array<{ key: SidebarGroupKey; tabs: T[] }> = [
    { key: 'monitor', tabs: tabs.filter((tab) => !MANAGE_PAGES.has(tab.slug) && !HELP_PAGES.has(tab.slug)) },
    { key: 'manage', tabs: tabs.filter((tab) => MANAGE_PAGES.has(tab.slug)) },
    { key: 'help', tabs: tabs.filter((tab) => HELP_PAGES.has(tab.slug)) },
  ];
  return groups.filter((g) => g.tabs.length > 0);
}

/** The factory's menu: its pages that are switched on. */
export function factoryTabs(
  factoryId: string,
  display: Display | null | undefined,
): Array<{ slug: string; label: string; href: string }> {
  const base = `/factories/${factoryId}`;
  return FACTORY_PAGES.filter((p) => ALWAYS_SHOWN.has(p.slug) || isShown(display, p.slug)).map((p) => ({
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

/** Empty performance result for views where Performance is switched off. */
export function noPerformance(factoryId: string): PerformanceResponse {
  return { factory_id: factoryId, from: '', to: '', avg_performance_percent: null, machines: [] };
}
