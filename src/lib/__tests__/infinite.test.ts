import { describe, expect, it } from 'vitest';

import { SCROLL_STEP, inBatches, nextOffset, nextShown } from '@/lib/infinite';

describe('nextShown: one more step of rows, never past the end', () => {
  it('adds a step', () => {
    expect(nextShown(20, 100)).toBe(20 + SCROLL_STEP);
    expect(nextShown(10, 100, 10)).toBe(20);
  });

  it('stops at the end', () => {
    expect(nextShown(90, 95)).toBe(95);
    expect(nextShown(95, 95)).toBe(95);
    expect(nextShown(0, 0)).toBe(0);
  });

  it('bad input never goes negative', () => {
    expect(nextShown(-5, 10)).toBe(10);
    expect(nextShown(5, -1)).toBe(0);
  });
});

describe('nextOffset: where the next page from the server starts', () => {
  it('after what is loaded, until the total', () => {
    expect(nextOffset(20, 57, 20)).toBe(20);
    expect(nextOffset(40, 57, 20)).toBe(40);
    expect(nextOffset(57, 57, 17)).toBeUndefined();
  });

  it('an empty page ends it even if the total says otherwise', () => {
    expect(nextOffset(40, 60, 0)).toBeUndefined();
  });
});

describe('inBatches', () => {
  it('in order, the last batch shorter', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inBatches([], 2)).toEqual([]);
    expect(inBatches(Array.from({ length: 45 }, (_, i) => i)).map((b) => b.length)).toEqual([20, 20, 5]);
  });
});
