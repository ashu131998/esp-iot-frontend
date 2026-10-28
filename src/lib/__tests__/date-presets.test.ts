import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  CURRENT_SHIFT,
  aggregatesOnly,
  buildPresets,
  phonePresets,
  presetSelection,
  selectionRange,
  type Preset,
} from '@/lib/date-presets';
import { DEFAULT_SHIFTS } from '@/lib/shifts';

// Day periods are local wall times; shifts resolve in factory time (APP_TZ, India), so their
// instants are written as IST below. Both hold in any time zone. Default shifts: day 06–18, night 18–06.
const at = (d: number, h: number, m = 0, s = 0, ms = 0) => new Date(2026, 9, d, h, m, s, ms);
const ist = (d: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, d, h, m) - 330 * 60_000);
const hm = (d: Date) => format(d, 'HH:mm'); // hints show the viewer's clock

function presetsAt(now: Date) {
  let t = now;
  const presets = buildPresets(DEFAULT_SHIFTS, () => t);
  return { presets, setNow: (n: Date) => { t = n; } };
}
const byId = (presets: Preset[], id: string) => presets.find((p) => p.id === id)!;

describe('buildPresets', () => {
  it('lists the periods in order', () => {
    const { presets } = presetsAt(at(28, 10, 30));
    expect(presets.map((p) => p.id)).toEqual(['current-shift', 'last-shift', '24h', 'today', '3d', '7d', '10d', '1m', '3m']);
  });

  it('names the shifts and their hours', () => {
    const { presets } = presetsAt(ist(28, 10, 30));
    expect(byId(presets, 'current-shift').hint).toBe(`Day · since ${hm(ist(28, 6))}`);
    expect(byId(presets, 'last-shift').hint).toBe(`Night · ${hm(ist(27, 18))}–${hm(ist(28, 6))}`);
    expect(byId(presets, 'last-shift').getDates()).toEqual({ from: ist(27, 18), to: ist(28, 6) });
  });

  it('counts rolling periods back from the moment of the tap', () => {
    const { presets, setNow } = presetsAt(at(28, 10, 30));
    setNow(at(28, 10, 45));
    expect(byId(presets, '24h').getDates()).toEqual({ from: at(27, 10, 45), to: at(28, 10, 45) });
    expect(byId(presets, 'today').getDates().from).toEqual(at(28, 0));
    expect(byId(presets, '1m').getDates().from).toEqual(new Date(2026, 8, 28));
    expect(byId(presets, '3m').getDates().from).toEqual(new Date(2026, 6, 28));
  });
});

describe('phonePresets', () => {
  it('keeps exactly the periods offered on phones', () => {
    const { presets } = presetsAt(at(28, 10, 30));
    expect(phonePresets(presets).map((p) => p.label)).toEqual([
      'Current Shift', 'Last Shift', 'Last 24 Hours', 'Today', 'Last 3 Days', 'Last 7 Days', 'Last Month', 'Last 3 Months',
    ]);
  });
});

describe('aggregatesOnly', () => {
  it('is true only before midnight 3 days back', () => {
    const now = at(28, 10);
    expect(aggregatesOnly(at(25, 0), now)).toBe(false);
    expect(aggregatesOnly(at(24, 23, 59), now)).toBe(true);
  });
});

describe('selectionRange', () => {
  const now = at(28, 10, 45);

  it('sends the current shift as live (no dates)', () => {
    expect(selectionRange(CURRENT_SHIFT, at(28, 0), at(28, 23, 59), '06:00', '10:45', now)).toBe('live');
  });

  it('sends nothing without both days', () => {
    expect(selectionRange(null, at(28, 0), null, '00:00', '23:59', now)).toBeNull();
  });

  it('sends recent days at the chosen minutes, the end minute included', () => {
    expect(selectionRange(null, at(27, 0), at(28, 23, 59), '10:45', '10:45', now))
      .toEqual({ from: at(27, 10, 45), to: at(28, 10, 45, 59, 999), dateOnly: false });
  });

  it('sends whole days once older than 3 days', () => {
    expect(selectionRange(null, at(21, 0), at(28, 23, 59), '00:00', '10:45', now))
      .toEqual({ from: at(21, 0), to: at(28, 23, 59, 59, 999), dateOnly: true });
  });
});

describe('presetSelection (one tap on a phone)', () => {
  const now = ist(28, 10, 45);
  const { presets } = presetsAt(now);
  const endMinute = (d: Date) => new Date(d.getTime() + 59_999);

  it('matches the panel for each kind of period', () => {
    expect(presetSelection(byId(presets, 'current-shift'), now)).toBe('live');
    expect(presetSelection(byId(presets, 'last-shift'), now))
      .toEqual({ from: ist(27, 18), to: endMinute(ist(28, 6)), dateOnly: false });
    expect(presetSelection(byId(presets, '24h'), now))
      .toEqual({ from: ist(27, 10, 45), to: endMinute(now), dateOnly: false });
    expect(presetSelection(byId(presets, '7d'), now))
      .toEqual({ from: startOfDay(subDays(now, 7)), to: endOfDay(now), dateOnly: true });
  });
});
