/**
 * Where to draw status segments on a timeline bar.
 *
 * Each segment sits at its real time inside the window (left / width in % of
 * the window), clipped to the window. Time that no segment covers stays empty
 * and reads as "No data". Laying segments end to end instead slid every
 * segment after a gap to the left: a stop at 00:58 was drawn at 19:00.
 */

export interface PlacedSegment<S> {
  segment: S;
  /** Position in the input list. */
  index: number;
  leftPct: number;
  widthPct: number;
}

/** Segments placed at their real times in [windowFrom, windowTo]; ones outside it are left out. */
export function placeSegments<S extends { from: string; to: string }>(
  segments: readonly S[],
  windowFrom: string,
  windowTo: string,
): PlacedSegment<S>[] {
  const start = Date.parse(windowFrom);
  const span = Date.parse(windowTo) - start;
  if (!(span > 0)) return [];
  const placed: PlacedSegment<S>[] = [];
  segments.forEach((segment, index) => {
    const from = Math.max(Date.parse(segment.from), start);
    const to = Math.min(Date.parse(segment.to), start + span);
    if (!(to > from)) return;
    placed.push({
      segment,
      index,
      leftPct: ((from - start) / span) * 100,
      widthPct: ((to - from) / span) * 100,
    });
  });
  return placed;
}

/** First start and last end of the segments, for a bar drawn without a known window. */
export function segmentsSpan(
  segments: ReadonlyArray<{ from: string; to: string }>,
): { from: string; to: string } | null {
  let from = Infinity;
  let to = -Infinity;
  for (const s of segments) {
    from = Math.min(from, Date.parse(s.from));
    to = Math.max(to, Date.parse(s.to));
  }
  return to > from ? { from: new Date(from).toISOString(), to: new Date(to).toISOString() } : null;
}
