import { describe, expect, it } from 'vitest';

import { runningShare, wholePercent } from '@/lib/plain-words';

describe('runningShare: the share a machine ran, on its Status Timeline card', () => {
  it('a whole percent with "running"', () => {
    expect(runningShare(92.4)).toBe('92% running');
    expect(runningShare(100)).toBe('100% running');
    expect(runningShare(0.6)).toBe('1% running');
  });

  it('nothing when it did not run (0%) or there is no data', () => {
    expect(runningShare(0)).toBeNull();
    expect(runningShare(0.4)).toBeNull();   // rounds to 0%
    expect(runningShare(null)).toBeNull();
    expect(runningShare(undefined)).toBeNull();
    expect(runningShare(Number.NaN)).toBeNull();
  });
});

describe('wholePercent', () => {
  it('rounds; unknown is a dash, never 0', () => {
    expect(wholePercent(49.5)).toBe('50%');
    expect(wholePercent(null)).toBe('—');
  });
});
