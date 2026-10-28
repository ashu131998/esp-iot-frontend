/**
 * The phone's bottom bar (below lg): up to four of the factory's pages — these first when
 * the factory has them switched on, then the next ones in menu order. Every page, these
 * included, is also in the menu behind "More".
 */
const BAR_FIRST: readonly string[] = ['overview', 'alerts', 'status-timeline', 'availability'];
export const BOTTOM_BAR_SIZE = 4;

/** Names that don't fit a bottom-bar slot (about 12 characters at 390 px). */
const SHORT_LABEL: Record<string, string> = {
  'status-timeline': 'Timeline',
  'shift-reports': 'Reports',
  'sensor-mapping': 'Sensors',
  configuration: 'Config',
};

export function bottomBarTabs<T extends { slug: string }>(tabs: readonly T[]): T[] {
  const picked = BAR_FIRST.flatMap((slug) => tabs.filter((t) => t.slug === slug));
  for (const t of tabs) {
    if (picked.length >= BOTTOM_BAR_SIZE) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked.slice(0, BOTTOM_BAR_SIZE);
}

export function shortLabel(tab: { slug: string; label: string }): string {
  return SHORT_LABEL[tab.slug] ?? tab.label;
}
