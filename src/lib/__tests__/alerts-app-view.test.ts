/**
 * An alert in the person's language (lib/alerts-app/view.ts): from the facts the engine attaches
 * (payload.view) the app says what happened in English, Hindi or Gujarati; an alert without them
 * keeps its English title; a reason the engine offers is translated, a configuration's name is not.
 */
import { describe, expect, it } from 'vitest';

import { alertWords, durationWords, factsOf, reasonWords } from '@/lib/alerts-app/view';
import type { MyAlert } from '@/lib/alerts-app/types';
import { hi } from '@/lib/i18n/messages/hi';
import { gu } from '@/lib/i18n/messages/gu';
import { englishTranslator, makeTranslator } from '@/lib/i18n/translate';

const en = englishTranslator;
const hindi = makeTranslator(hi, 'hi');
const gujarati = makeTranslator(gu, 'gu');

const alert = (over: Partial<MyAlert> = {}): MyAlert => ({
  notification_id: 'ntf-1', factory_id: 'mill', factory_name: 'Shree Mills', type: 'machine_down', title: '🔴 Loom 3 is DOWN', severity: 'HIGH',
  message: '🔴 MACHINE DOWN\nLoom 3 (line-1) stopped at 10:02 am.', machine_id: 'm3', machine_name: 'Loom 3', payload: null,
  created_at: '2026-11-17T04:32:00.000Z', read_at: null, resolved_at: null, resolution: null, ...over,
});
const AT = '2026-11-17T04:32:00.000Z';   // 10:02 am IST
const OPTIONS = [{ id: 'dtr|rep-1|yarn_breakage', label: 'Yarn breakage' }];

describe('the facts', () => {
  it('are there only when the engine attached them', () => {
    expect(factsOf(alert())).toBeNull();
    expect(factsOf(alert({ payload: { view: { machine: 'x' } } }))).toBeNull();   // no kind
    expect(factsOf(alert({ payload: { view: { kind: 'machine_down', machine: 'Loom 3' } } }))).toEqual({ kind: 'machine_down', machine: 'Loom 3' });
  });
});

describe('a stop', () => {
  const down = alert({ payload: { kind: 'downtime_reason', options: OPTIONS, view: { kind: 'machine_down', machine: 'Loom 3', line: 'line-1', at: AT } } });

  it('in English, with the question while it is open', () => {
    expect(alertWords(down, en)).toEqual({ title: 'Loom 3 stopped', body: 'Loom 3 stopped at 10:02 am.\nWhy is it down? Tap an answer below.' });
    expect(alertWords({ ...down, resolved_at: '2026-11-17T05:00:00Z' }, en).body).toBe('Loom 3 stopped at 10:02 am.');
  });

  it('in Hindi and Gujarati, the machine name as it is', () => {
    expect(alertWords(down, hindi)).toEqual({ title: 'Loom 3 रुक गई', body: 'Loom 3 10:02 am पर रुक गई।\nयह क्यों रुकी? नीचे एक जवाब पर टैप करें।' });
    expect(alertWords(down, gujarati).title).toBe('Loom 3 બંધ થઈ');
  });

  it('without the facts: the English title, no body', () => {
    expect(alertWords(alert(), hindi)).toEqual({ title: '🔴 Loom 3 is DOWN', body: null });
  });
});

describe('running again', () => {
  const up = (payload: MyAlert['payload']) => alert({ type: 'machine_up_config', title: '🟢 Loom 3 is UP', severity: 'MEDIUM', payload });

  it('says how long it was down and what it asks', () => {
    const config = up({ kind: 'config_selection', options: [{ id: 'cfg|mill|m3|p1', label: 'Plain weave' }], view: { kind: 'machine_up', machine: 'Loom 3', at: AT, down_for_min: 72 } });
    expect(alertWords(config, en)).toEqual({ title: 'Loom 3 is running again', body: 'Loom 3 came back at 10:02 am after 1 h 12 m.\nWhich configuration is it running? Tap one below.' });
    const fix = up({ kind: 'fix_confirmation', options: [{ id: 'fix|rep-1', label: 'Yes, I fixed it' }], view: { kind: 'machine_up', machine: 'Loom 3', at: AT, down_for_min: 5 } });
    expect(alertWords(fix, en).body).toBe('Loom 3 came back at 10:02 am after 5 m.\nDid you get it running? Tap below.');
    expect(alertWords(fix, hindi).title).toBe('Loom 3 फिर चल रही है');
  });
});

describe('a shift reminder', () => {
  it('the shift and its time, then the task, machines and configuration', () => {
    const a = alert({ type: 'shift_reminder', severity: 'LOW', payload: { view: { kind: 'shift_reminder', shift: 'Day Shift', start: '2026-11-17T00:30:00.000Z', task: 'Weaving', machines: ['Loom 3', 'Loom 4'], profile: 'Plain weave' } } });
    expect(alertWords(a, en)).toEqual({ title: 'Day Shift starts at 06:00 am', body: 'Task: Weaving\nMachines: Loom 3, Loom 4\nConfiguration: Plain weave' });
    expect(alertWords(a, hindi).title).toBe('Day Shift 06:00 am पर शुरू होती है');
    const bare = alert({ type: 'shift_reminder', payload: { view: { kind: 'shift_reminder', shift: 'Night Shift' } } });
    expect(alertWords(bare, en)).toEqual({ title: 'Night Shift starts soon', body: null });
  });
});

describe('what an owner hears', () => {
  it('a stop, and who was asked; a machine nobody is on; back up after a while', () => {
    const down = alert({ type: 'owner_machine_down', payload: { view: { kind: 'owner_down', machine: 'Loom 3', at: AT, operators: ['Ravi'] } } });
    expect(alertWords(down, en)).toEqual({ title: 'Loom 3 stopped', body: 'Loom 3 stopped at 10:02 am.\nRavi has been asked for the reason in the app.' });
    const nobody = alert({ type: 'owner_machine_down', payload: { view: { kind: 'owner_down', machine: 'Loom 3', at: AT, operators: [] } } });
    expect(alertWords(nobody, en).body).toBe('Loom 3 stopped at 10:02 am.\nNo operator is assigned to this machine right now.');
    const up = alert({ type: 'owner_machine_up', payload: { view: { kind: 'owner_up', machine: 'Loom 3', at: AT, down_for_min: 30 } } });
    expect(alertWords(up, en)).toEqual({ title: 'Loom 3 is running again', body: 'Loom 3 came back at 10:02 am after 30 m.' });
    expect(alertWords(up, gujarati).title).toBe('Loom 3 ફરી ચાલે છે');
  });

  it('something in front of a camera: which one, at which machine, since when; in Hindi too', () => {
    const blocked = alert({ type: 'camera_blocked', payload: { view: { kind: 'camera_blocked', camera: 'cam-478998', machine: 'Loom 3', at: AT } } });
    expect(alertWords(blocked, en)).toEqual({
      title: 'Something is in front of cam-478998 at Loom 3',
      body: 'Since 10:02 am: a hand on the lens, a cover, or something big right in front of it. Watch it live on the Cameras page.',
    });
    const nowhere = alert({ type: 'camera_blocked', payload: { view: { kind: 'camera_blocked', camera: null, machine: null, at: null } } });
    expect(alertWords(nowhere, en)).toEqual({
      title: 'Something is in front of A camera',
      body: 'A hand on the lens, a cover, or something big right in front of it. Watch it live on the Cameras page.',
    });
    expect(alertWords(blocked, hindi).title).toBe('Loom 3 पर cam-478998 के सामने कुछ है');
  });

  it('a truck or a hand the camera\'s AI models saw: which camera, where, when; in Hindi and Gujarati too', () => {
    const truck = alert({ type: 'camera_truck', payload: { view: { kind: 'camera_truck', camera: 'cam-478998', machine: 'Gate 1', at: AT } } });
    expect(alertWords(truck, en)).toEqual({
      title: 'A truck at cam-478998 at Gate 1',
      body: 'Seen at 10:02 am. Its picture and live view are on the Cameras page.',
    });
    const hand = alert({ type: 'camera_hand', payload: { view: { kind: 'camera_hand', camera: 'cam-478998', machine: null, at: null } } });
    expect(alertWords(hand, en)).toEqual({ title: 'A hand in front of cam-478998', body: 'Its picture and live view are on the Cameras page.' });
    expect(alertWords(truck, hindi).title).toBe('Gate 1 पर cam-478998 पर एक ट्रक');
    expect(alertWords(hand, gujarati).title).toBe('cam-478998ની સામે એક હાથ');
  });

  it('trucks: how many came; the truck left, when and how long it was there; in Hindi too', () => {
    const two = alert({ type: 'camera_truck', payload: { view: { kind: 'camera_truck', camera: 'cam-478998', machine: 'Gate 1', at: AT, count: 2 } } });
    expect(alertWords(two, en).title).toBe('2 trucks at cam-478998 at Gate 1');
    const left = alert({ type: 'camera_truck_left', payload: { view: { kind: 'camera_truck_left', camera: 'cam-478998', machine: 'Gate 1', at: AT, stay_s: 130, count: 1 } } });
    expect(alertWords(left, en)).toEqual({ title: 'The truck left cam-478998 at Gate 1', body: 'Left at 10:02 am; it was there 2 m 10 s.' });
    const both = alert({ type: 'camera_truck_left', payload: { view: { kind: 'camera_truck_left', camera: 'cam-478998', machine: null, at: null, stay_s: null, count: 3 } } });
    expect(alertWords(both, en)).toEqual({ title: '3 trucks left cam-478998', body: null });
    expect(alertWords(left, hindi).title).toBe('ट्रक Gate 1 पर cam-478998 से चला गया');
  });

  it('a kind it does not know: the English title', () => {
    expect(alertWords(alert({ payload: { view: { kind: 'something_new' } } }), en)).toEqual({ title: '🔴 Loom 3 is DOWN', body: null });
  });
});

describe('words', () => {
  it('durations', () => {
    expect(durationWords(5, en.t)).toBe('5 m');
    expect(durationWords(60, en.t)).toBe('1 h');
    expect(durationWords(72, en.t)).toBe('1 h 12 m');
    expect(durationWords(0.2, en.t)).toBe('1 m');
    expect(durationWords(72, hindi.t)).toBe('1 घं 12 मि');
  });

  it('the engine\'s reasons are translated; a configuration\'s name is not', () => {
    expect(reasonWords('Yarn breakage', hindi.t)).toBe(hi['Yarn breakage']);
    expect(reasonWords('Other', gujarati.t)).toBe(gu['Other']);
    expect(reasonWords('Plain weave', hindi.t)).toBe('Plain weave');
  });
});

describe('a stop nobody answered', () => {
  const waiting = alert({ title: '🔴 Loom 3 still DOWN — no reason yet', payload: { kind: 'downtime_reason', options: OPTIONS, view: { kind: 'machine_down_waiting', machine: 'Loom 3', at: AT, waiting_min: 12 } } });

  it('the supervisor gets the question with how long it has been', () => {
    expect(alertWords(waiting, en)).toEqual({ title: 'Loom 3 is still stopped', body: 'Loom 3 has been stopped for 12 m. Nobody has said why yet.\nWhy is it down? Tap an answer below.' });
    expect(alertWords(waiting, hindi).title).toBe('Loom 3 अब भी रुकी है');
    expect(alertWords(waiting, gujarati).body).toContain('12 મિ થી બંધ છે');
  });

  it('the owner is told, with nothing to answer; without the minutes it still reads', () => {
    const owner = alert({ type: 'owner_machine_down_unanswered', payload: { view: { kind: 'owner_unanswered', machine: 'Loom 3', at: AT, waiting_min: 75 } } });
    expect(alertWords(owner, en)).toEqual({ title: 'Loom 3 is still stopped', body: 'Loom 3 has been stopped for 1 h 15 m. Nobody has said why yet.' });
    const bare = alert({ payload: { view: { kind: 'owner_unanswered', machine: 'Loom 3' } } });
    expect(alertWords(bare, en).body).toBe('Loom 3 is still stopped. Nobody has said why yet.');
  });
});
