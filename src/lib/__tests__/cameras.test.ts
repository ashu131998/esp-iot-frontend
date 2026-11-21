import { describe, expect, it } from 'vitest';

import {
  EVENT_TONE, PICTURE_EVERY, cameraTitle, eventWords, isVisit, pictureEveryWord, pictureKindWord, pictureUrl, stayWords, summaryWords,
  truckNowWords, visitWords, type Camera,
} from '@/lib/cameras';
import { englishTranslator } from '@/lib/i18n/translate';

const { t, tn } = englishTranslator;
const cam = (extra: Partial<Camera> = {}): Camera => ({
  board_id: 'cam-a1', line_id: 'l1', machine_id: null, machine_name: null, online: true, last_beat_at: null, camera: 'ok', view: 'clear',
  fw: '2.9.6-cam', cfg_version: 1, view_alert: true, settings: { exposure: -1, gain: -1, flip: false, mirror: false, pic_every_s: 600, snap: 0 },
  last_picture: null, ...extra,
});

describe('the Cameras page words', () => {
  it('a camera by its machine, else its id; its pictures; its events', () => {
    expect(cameraTitle(cam({ machine_name: 'Loom 3' }), t)).toBe('Camera at Loom 3');
    expect(cameraTitle(cam(), t)).toBe('Camera cam-a1');
    expect(pictureUrl('mill 1', 'cam-a1', 42)).toBe('/api/v1/factories/mill%201/cameras/cam-a1/pictures/42');
    expect(['alert', 'snap', 'periodic', 'motion'].map((kind) => pictureKindWord({ kind: kind as never, state: null }, t)))
      .toEqual(['Something in front of it', 'Picture on request', 'Routine picture', 'Movement']);
    expect([eventWords({ state: 'blocked' }, t), eventWords({ state: 'ok' }, t)]).toEqual(['Something in front of the camera', 'The view is clear again']);
    expect([EVENT_TONE({ state: 'blocked' }), EVENT_TONE({ state: 'ok' })]).toEqual(['bad', 'good']);
  });

  it('what the AI models saw: a truck (amber), a hand (red); an event picture says which', () => {
    expect([eventWords({ state: 'truck' }, t), eventWords({ state: 'hand' }, t)]).toEqual(['A truck', 'A hand in front of the camera']);
    expect([EVENT_TONE({ state: 'truck' }), EVENT_TONE({ state: 'hand' })]).toEqual(['warn', 'bad']);
    expect(pictureKindWord({ kind: 'alert', state: 'truck' }, t)).toBe('A truck');
    expect(pictureKindWord({ kind: 'alert', state: 'hand' }, t)).toBe('A hand in front of the camera');
    expect(pictureKindWord({ kind: 'alert', state: 'blocked' }, t)).toBe('Something in front of it');
  });

  it('a truck\'s visit: how long it was there, still here, how many; a visit is told from a sighting by its id', () => {
    expect([0, 40, 60, 130, 3600, 3900].map((s) => stayWords(s, t))).toEqual(['0 s', '40 s', '1 m', '2 m 10 s', '1 h', '1 h 5 m']);
    const at = '2026-11-21T06:40:00.000Z';
    expect(visitWords({ occurred_at: at, ended_at: '2026-11-21T06:42:10.000Z', count: 1 }, t)).toBe('A truck · there 2 m 10 s');
    expect(visitWords({ occurred_at: at, ended_at: null, count: 2 }, t)).toBe('2 trucks · still here');
    expect([isVisit({ id: 'v3' }), isVisit({ id: 's3' }), isVisit({ id: 3 })]).toEqual([true, false, false]);
    expect(truckNowWords({ since: at, count: 1 }, '12:10:00 pm', tn)).toBe('A truck is here now (since 12:10:00 pm)');
    expect(truckNowWords({ since: at, count: 3 }, '12:10:00 pm', tn)).toBe('3 trucks are here now (since 12:10:00 pm)');
  });

  it('a truck there now comes first after something in front; an offline camera\'s is not counted', () => {
    const gate = cam({ machine_name: 'Gate 1', truck: { since: '2026-11-21T06:40:00.000Z', count: 2 } });
    expect(summaryWords([gate, cam({ board_id: 'cam-b2', online: false })], t, tn))
      .toEqual({ tone: 'warn', badge: 2, title: '2 trucks are here now', subtitle: 'Camera at Gate 1: watch it live.' });
    expect(summaryWords([cam({ truck: { since: '2026-11-21T06:40:00.000Z', count: 1 }, online: false })], t, tn).title).toBe('1 camera is offline');
  });

  it('how often a picture, in words', () => {
    expect(PICTURE_EVERY.map((s) => pictureEveryWord(s, t, tn))).toEqual([
      'Only when something happens or I ask', 'Every 5 minutes', 'Every 10 minutes', 'Every 30 minutes', 'Every hour',
    ]);
    expect([pictureEveryWord(60, t, tn), pictureEveryWord(7200, t, tn)]).toEqual(['Every minute', 'Every 2 hours']);
  });

  it('the sentence first: something in front of one, then cameras off, else all on', () => {
    expect(summaryWords([], t, tn)).toMatchObject({ tone: 'idle', title: 'No camera yet' });
    expect(summaryWords([cam({ view: 'blocked', machine_name: 'Loom 3' }), cam({ online: false })], t, tn))
      .toEqual({ tone: 'bad', badge: 1, title: 'Something is in front of 1 camera', subtitle: 'Camera at Loom 3: check that nobody is blocking it.' });
    expect(summaryWords([cam({ view: 'blocked', online: false })], t, tn)).toMatchObject({ tone: 'warn', title: '1 camera is offline' });   // offline: not "now"
    expect(summaryWords([cam(), cam({ board_id: 'cam-b2' })], t, tn)).toMatchObject({ tone: 'good', title: 'All 2 cameras are on' });
    expect(summaryWords([cam()], t, tn).title).toBe('The camera is on');
  });
});
