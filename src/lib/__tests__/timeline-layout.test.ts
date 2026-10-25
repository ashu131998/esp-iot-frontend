import { describe, expect, it } from 'vitest';

import { placeMarks, placeSegments, segmentsSpan } from '@/lib/timeline-layout';

const at = (hhmm: string, day = 25) => `2026-10-${day}T${hhmm}:00.000Z`;
const seg = (from: string, to: string, status = 'up') => ({ from, to, status });
const round = (placed: ReturnType<typeof placeSegments>) =>
  placed.map((p) => [p.index, +p.leftPct.toFixed(3), +p.widthPct.toFixed(3)]);

describe('placeSegments', () => {
  it('lays contiguous segments edge to edge across the whole window', () => {
    const placed = placeSegments([seg(at('00:00'), at('06:00')), seg(at('06:00'), at('12:00'), 'down')], at('00:00'), at('12:00'));
    expect(round(placed)).toEqual([[0, 0, 50], [1, 50, 50]]);
  });

  it('draws a segment after a gap at its real time, leaving the gap empty (the 00:58 stop)', () => {
    // 24 h window 01:07 → 01:07: idle until 18:54, nothing until 00:58, stopped since.
    const window = [at('01:07', 24), at('01:07', 25)] as const;
    const placed = placeSegments(
      [seg(at('01:07', 24), at('18:54', 24), 'idle'), seg(at('00:58', 25), at('01:07', 25), 'down')],
      ...window,
    );
    const [idle, down] = placed;
    expect(idle.leftPct).toBe(0);
    expect(idle.widthPct).toBeCloseTo((17 * 60 + 47) / 1440 * 100, 6);
    expect(down.leftPct).toBeCloseTo((1440 - 9) / 1440 * 100, 6);   // at 00:58, not right after 18:54
    expect(down.leftPct + down.widthPct).toBeCloseTo(100, 6);
  });

  it('clips segments that start before or end after the window', () => {
    const placed = placeSegments([seg(at('22:00', 24), at('01:00')), seg(at('01:00'), at('05:00'))], at('00:00'), at('02:00'));
    expect(round(placed)).toEqual([[0, 0, 50], [1, 50, 50]]);
  });

  it('leaves out segments wholly outside the window (the 2 h detail view)', () => {
    const placed = placeSegments(
      [seg(at('01:07', 24), at('18:54', 24), 'idle'), seg(at('00:58'), at('01:07'), 'down')],
      at('23:07', 24), at('01:07'),
    );
    expect(placed).toHaveLength(1);
    expect(placed[0].index).toBe(1);
    expect(placed[0].leftPct).toBeCloseTo(111 / 120 * 100, 6);
    expect(placed[0].widthPct).toBeCloseTo(9 / 120 * 100, 6);
  });

  it('places by time whatever order the segments come in', () => {
    const placed = placeSegments([seg(at('06:00'), at('12:00')), seg(at('00:00'), at('06:00'))], at('00:00'), at('12:00'));
    expect(round(placed)).toEqual([[0, 50, 50], [1, 0, 50]]);
  });

  it('skips empty and unreadable segments, and draws nothing for an empty or reversed window', () => {
    expect(placeSegments([seg(at('01:00'), at('01:00')), seg('bad', at('02:00'))], at('00:00'), at('03:00'))).toEqual([]);
    expect(placeSegments([seg(at('00:00'), at('01:00'))], at('01:00'), at('01:00'))).toEqual([]);
    expect(placeSegments([seg(at('00:00'), at('01:00'))], at('02:00'), at('01:00'))).toEqual([]);
    expect(placeSegments([seg(at('00:00'), at('01:00'))], 'bad', at('01:00'))).toEqual([]);
  });
});

describe('segmentsSpan', () => {
  it('runs from the first start to the last end, whatever the order', () => {
    expect(segmentsSpan([seg(at('06:00'), at('09:00')), seg(at('01:00'), at('02:00'))]))
      .toEqual({ from: at('01:00'), to: at('09:00') });
  });

  it('is null without segments or time', () => {
    expect(segmentsSpan([])).toBeNull();
    expect(segmentsSpan([seg(at('01:00'), at('01:00'))])).toBeNull();
  });
});

describe('placeMarks: power cuts on a timeline bar', () => {
  const W = { from: '2026-10-25T00:00:00.000Z', to: '2026-10-25T10:00:00.000Z' };   // 10 h

  it('at its real time; a one-second cut keeps its place though it is far below a pixel', () => {
    const [m] = placeMarks([{ from: '2026-10-25T05:00:00.000Z', to: '2026-10-25T05:00:01.000Z' }], W.from, W.to);
    expect(m.leftPct).toBe(50);
    expect(m.widthPct).toBeCloseTo(100 / 36000, 10);
  });

  it('clipped to the window; ones outside it, or nonsense, are left out', () => {
    const marks = placeMarks([
      { from: '2026-10-24T23:59:00.000Z', to: '2026-10-25T00:01:00.000Z' },
      { from: '2026-10-25T11:00:00.000Z', to: '2026-10-25T11:00:05.000Z' },
      { from: 'garbage', to: '2026-10-25T01:00:00.000Z' },
    ], W.from, W.to);
    expect(marks).toHaveLength(1);
    expect(marks[0].leftPct).toBe(0);
    expect(marks[0].widthPct).toBeCloseTo(100 / 600, 10);
  });

  it('nothing to place, or no window: none', () => {
    expect(placeMarks(undefined, W.from, W.to)).toEqual([]);
    expect(placeMarks([{ from: W.from, to: W.to }], W.to, W.from)).toEqual([]);
  });
});
