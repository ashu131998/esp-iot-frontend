import { describe, expect, it } from 'vitest';

import { lineLabel, prettyId } from '@/lib/lines';

describe('a line\'s label', () => {
  it('its own name when it has one; its ID made readable otherwise', () => {
    expect(lineLabel({ line_id: 'line-1', name: 'Weaving A' })).toBe('Weaving A');
    expect(lineLabel({ line_id: 'line-1', name: 'line-1' })).toBe('Line 1');
    expect(lineLabel({ line_id: 'line-1', name: '  ' })).toBe('Line 1');
    expect(lineLabel({ line_id: 'LINE-1', name: 'line-1' })).toBe('LINE 1');
    expect(lineLabel({ line_id: 'press_shop-2' })).toBe('Press Shop 2');
    expect(lineLabel(null)).toBe('—');
  });

  it('prettyId: words capitalised, numbers kept, separators to spaces', () => {
    expect(prettyId('line-12')).toBe('Line 12');
    expect(prettyId('rescue')).toBe('Rescue');
    expect(prettyId('2nd-floor_east')).toBe('2nd Floor East');
    expect(prettyId('--')).toBe('');
  });
});
