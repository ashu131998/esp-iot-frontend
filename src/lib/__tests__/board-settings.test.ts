import { describe, expect, it } from 'vitest';

import {
  defaultBoardSettings, freeSlots, kindForSlot, newChannel, settingsProblems, type BoardSettings,
} from '@/lib/board-settings';

describe('board settings (Boards page)', () => {
  it('REV B defaults are good to send, and use I1–I4, P1–P2', () => {
    const d = defaultBoardSettings();
    expect(settingsProblems(d)).toEqual([]);
    expect(freeSlots(d)).toEqual(['T1', 'T2', 'V1', 'V2']);
  });

  it('each slot takes one kind of sensor', () => {
    expect(kindForSlot('I3')).toBe('current');
    expect(kindForSlot('p1')).toBe('proximity');
    expect(kindForSlot('T2')).toBe('ds18b20');
    expect(kindForSlot('X1')).toBeNull();
    expect(newChannel('I2')).toEqual({ slot: 'I2', type: 'current', name: 'I2', cal: 30 });
    expect(newChannel('T1')).toEqual({ slot: 'T1', type: 'ds18b20', name: 'T1' });
  });

  it('problems: in plain words', () => {
    const s: BoardSettings = {
      channels: [
        { slot: 'I1', type: 'current', name: 'I1', cal: 0 },
        { slot: 'I1', type: 'current', name: 'I1', cal: 15 },
        { slot: 'P1', type: 'current', name: 'P1', cal: 15 },
        { slot: 'T1', type: 'ds18b20', name: 'x'.repeat(30), rom: 'nope' },
      ],
      thresholds: { on_amps: 0, confirm_samples: 2.5 },
    };
    expect(settingsProblems(s)).toEqual([
      'I1: calibration must be between 0 and 1000.',
      'Slot I1 is used twice.',
      'Slot P1 takes Proximity.',
      'T1: sensor ROM must be 16 hex digits.',
      'T1: name can be at most 23 characters.',
      'On threshold must be between 0 and 100 A.',
      'Confirm samples must be a whole number from 1 to 60.',
    ]);
    expect(settingsProblems({ channels: [], thresholds: { on_amps: 0.12, confirm_samples: 5 } }))
      .toEqual(['Add at least one sensor channel.']);
  });
});
