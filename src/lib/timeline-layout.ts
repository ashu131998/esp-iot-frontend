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

export interface PlacedMark {
  from: string;
  to: string;
  /** Left edge and width as % of the window (width may be ~0: draw it with a minimum width). */
  leftPct: number;
  widthPct: number;
}

/**
 * Short events — power cuts — on a timeline bar: each at its real time, clipped to the
 * window, kept even when far too short for a pixel (the bar draws them at a minimum width).
 */
export function placeMarks(
  marks: { from: string; to: string }[] | undefined,
  windowFrom: string,
  windowTo: string,
): PlacedMark[] {
  const start = Date.parse(windowFrom);
  const end = Date.parse(windowTo);
  if (!(end > start)) return [];
  const span = end - start;
  return (marks ?? []).flatMap((m) => {
    const a = Date.parse(m.from);
    const b = Math.max(Date.parse(m.to), a);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < start || a > end) return [];
    const from = Math.max(a, start);
    const to = Math.min(b, end);
    return [{ from: m.from, to: m.to, leftPct: ((from - start) / span) * 100, widthPct: ((to - from) / span) * 100 }];
  });
}
