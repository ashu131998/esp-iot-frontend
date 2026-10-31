/**
 * Infinite scroll instead of pages (user, 2026-10-31: wherever rows show quickly, no Previous/Next).
 * A list shows its first rows, and the next ones come as its end scrolls into view: from memory for
 * a list loaded whole, page by page from the server for a long one (Team, Quality, the ops lists).
 */

/** Rows shown first, and added each time the end of a list comes into view. */
export const SCROLL_STEP = 20;

/** How many rows to show after one more step: never past the end. */
export function nextShown(shown: number, total: number, step = SCROLL_STEP): number {
  return Math.min(Math.max(total, 0), Math.max(shown, 0) + step);
}

/**
 * Where the server's next page starts (react-query getNextPageParam), or undefined once every row
 * is loaded. An empty page also ends it: a total that never comes true must not fetch forever.
 */
export function nextOffset(loaded: number, total: number, lastPageSize: number): number | undefined {
  if (lastPageSize === 0) return undefined;
  return loaded < total ? loaded : undefined;
}

/** A list in batches, in order (rows whose details are fetched a batch at a time). */
export function inBatches<T>(items: readonly T[], size = SCROLL_STEP): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
