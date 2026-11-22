/**
 * When an admin's phone rings (lib/alerts-app/ring-rules.ts): the half-hour choices for the ringing
 * hours, their 12-hour labels, and one change made to the rules (what the Settings card saves).
 */
import { describe, expect, it } from 'vitest';

import { RING_KINDS, clockLabel, timeChoices, withChange, type RingRules } from '@/lib/alerts-app/ring-rules';

const RULES: RingRules = { hours: { on: false, from: '08:00', to: '22:00' }, machine_always: true, kinds: { machine_stopped: true, machine_running: true, camera: true, shift: true } };

describe('ring rules', () => {
  it('every half hour of the day, on the app\'s 12-hour clock', () => {
    const choices = timeChoices();
    expect(choices).toHaveLength(48);
    expect(choices.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
    expect(choices.at(-1)).toBe('23:30');
    expect(['00:00', '00:30', '08:00', '12:00', '12:30', '22:00', '23:30'].map(clockLabel)).toEqual(['12:00 am', '12:30 am', '8:00 am', '12:00 pm', '12:30 pm', '10:00 pm', '11:30 pm']);
  });

  it('one change at a time, the rest as it was (never the same object)', () => {
    expect(withChange(RULES, { hours: { on: true } }).hours).toEqual({ on: true, from: '08:00', to: '22:00' });
    expect(withChange(RULES, { hours: { to: '20:30' } }).hours.to).toBe('20:30');
    expect(withChange(RULES, { machine_always: false }).machine_always).toBe(false);
    const quietCameras = withChange(RULES, { kind: ['camera', false] });
    expect(quietCameras.kinds).toEqual({ ...RULES.kinds, camera: false });
    expect(quietCameras.kinds).not.toBe(RULES.kinds);
    expect(withChange(RULES, {})).toEqual(RULES);
    expect(RING_KINDS).toEqual(['machine_stopped', 'machine_running', 'camera', 'shift']);
  });
});
