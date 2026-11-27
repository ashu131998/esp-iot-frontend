/**
 * The phone's bottom bar (below lg, and the FloorBeat app): the factory's pages our staff put on it
 * (staff console, Pages & branding; `bar.<page>` in the factory's display, query-api display.js),
 * these first, then menu order. Up to four sit beside "More", whose menu holds the rest (moreTabs);
 * when every page of the factory is on the bar and they fit (five), there is no "More".
 */
import { OFF_BAR_PAGES, type Display } from '@/lib/display';

const BAR_FIRST: readonly string[] = ['overview', 'alerts', 'status-timeline', 'availability'];
/** Pages on the bar beside "More". */
export const BOTTOM_BAR_SIZE = 4;
/** Pages on the bar when it holds all of them: "More" gives up its place. */
export const BOTTOM_BAR_FULL = 5;
export const BAR_PREFIX = 'bar.';

/** Names that don't fit a bottom-bar slot (about 12 characters at 390 px). */
const SHORT_LABEL: Record<string, string> = {
  'status-timeline': 'Timeline',
  'shift-reports': 'Reports',
  'sensor-mapping': 'Sensors',
  configuration: 'Config',
};

/** The bar's order: the main pages first, then the menu's; a page that never sits on the bar left out (Alert settings). */
function inBarOrder<T extends { slug: string }>(tabs: readonly T[]): T[] {
  const can = tabs.filter((t) => !OFF_BAR_PAGES.has(t.slug));
  return [...BAR_FIRST.flatMap((slug) => can.filter((t) => t.slug === slug)), ...can.filter((t) => !BAR_FIRST.includes(t.slug))];
}

/** Whether the factory's display says which pages are on the bar (a server from before the switches says nothing). */
function barChosen(display: Display | null | undefined): boolean {
  return Boolean(display) && Object.keys(display as Display).some((key) => key.startsWith(BAR_PREFIX));
}

/** The pages our staff put on the bar, of the ones this person sees, in the bar's order. */
export function barPages<T extends { slug: string }>(tabs: readonly T[], display?: Display | null): T[] {
  const ordered = inBarOrder(tabs);
  // Before the switches: the first four in the bar's order.
  if (!barChosen(display)) return ordered.slice(0, BOTTOM_BAR_SIZE);
  return ordered.filter((t) => display?.[`${BAR_PREFIX}${t.slug}`] === true);
}

export function bottomBarTabs<T extends { slug: string }>(tabs: readonly T[], display?: Display | null): T[] {
  const chosen = barPages(tabs, display);
  if (chosen.length === tabs.length && chosen.length <= BOTTOM_BAR_FULL) return chosen;   // all of them, no "More"
  return chosen.slice(0, BOTTOM_BAR_SIZE);
}

/** The menu behind "More": the pages not on the bottom bar, in menu order; none when the bar holds them all. */
export function moreTabs<T extends { slug: string }>(tabs: readonly T[], display?: Display | null): T[] {
  const bar = bottomBarTabs(tabs, display);
  return tabs.filter((t) => !bar.includes(t));
}

export function shortLabel(tab: { slug: string; label: string }): string {
  return SHORT_LABEL[tab.slug] ?? tab.label;
}

/**
 * What the staff editor saves when one page's place changes: every page's place at once
 * ({ 'bar.<slug>': on the bar? }), so the bar is exactly what the editor showed. `pages`: every page
 * of the menu; `visible`: the ones this factory has on (a page that is off keeps the place it had).
 * A page that never sits on the bar is not sent: the server refuses a switch it has not got.
 */
export function barPatch(
  pages: readonly { slug: string }[],
  visible: readonly { slug: string }[],
  display: Display | null | undefined,
  change: { slug: string; on: boolean },
): Record<string, boolean> {
  const onBar = new Set(barPages(visible, display).map((t) => t.slug));
  const chosen = barChosen(display);
  const patch: Record<string, boolean> = {};
  for (const { slug } of pages) {
    if (OFF_BAR_PAGES.has(slug)) continue;
    const now = chosen ? display?.[`${BAR_PREFIX}${slug}`] === true : onBar.has(slug);
    patch[`${BAR_PREFIX}${slug}`] = slug === change.slug ? change.on : now;
  }
  return patch;
}
