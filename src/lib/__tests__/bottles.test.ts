import { describe, expect, it } from 'vitest';

import {
  CAM_SLOTS, boxProblem, bottleWords, bottlesQueryKey, cameraTitle, clampRect, cleanBoxes, eventWords, fracToPoint,
  hitBox, hitCorner, levelWord, moveRect, newBox, nextSlot, pictureKindWord, pictureUrl, rectFromDrag, rectToFrac,
  resizeRect, settingsProblem, summaryWords, type Bottle, type BottleCamera, type CamBox, type CamSettings, type LevelEvent,
} from '@/lib/bottles';
import { englishTranslator } from '@/lib/i18n/translate';

const { t, tn } = englishTranslator;
const REF = { ref_w: 640, ref_h: 480 };
const SETTINGS: CamSettings = {
  ref_w: 640, ref_h: 480, period_s: 5, need: 3, hyst: 5, dark: 110, bright: 150, exposure: -1, gain: -1,
  flip: false, mirror: false, quality: 12, pic_every_s: 600, snap: 0,
};
const bottle = (over: Partial<Bottle> = {}): Bottle => ({
  slot: 'B1', name: 'Red', low: 15, cap: 20, box: { x: 100, y: 40, w: 80, h: 360 }, state: 'ok', percent: 72, present: true,
  at: '2026-11-17T10:00:00Z', ...over,
});
const camera = (over: Partial<BottleCamera> = {}): BottleCamera => ({
  board_id: 'cam-a1b2c3', line_id: 'line-1', machine_id: 'm1', machine_name: 'Loom 3', online: true,
  last_beat_at: '2026-11-17T10:00:05Z', camera: 'ok', fw: '2.9.0-cam', cfg_version: 5000, settings: SETTINGS,
  bottles: [bottle()], last_picture: null, ...over,
});
const box = (over: Partial<CamBox> = {}): CamBox => ({ slot: 'B1', name: 'Red', x: 100, y: 40, w: 80, h: 360, low: 15, cap: 20, ...over });
const event = (over: Partial<LevelEvent> = {}): LevelEvent => ({
  id: 1, slot: 'B1', name: 'Red', state: 'low', prev: 'ok', percent: 12.4, present: true, low: 15, ev: 7,
  occurred_at: '2026-11-17T10:00:00Z', picture_id: 42, ...over,
});

describe('summaryWords: the sentence to read first', () => {
  it('no camera, then no boxes: says what comes next', () => {
    expect(summaryWords([], t, tn)).toMatchObject({ tone: 'idle', title: 'No dye camera yet' });
    const w = summaryWords([camera({ bottles: [] })], t, tn);
    expect(w).toMatchObject({ tone: 'idle', title: 'Draw a box around each bottle to start' });
    expect(w.subtitle).toBe('1 camera is ready: open its bottles and settings.');
    expect(summaryWords([camera({ bottles: [] }), camera({ bottles: [] })], t, tn).subtitle).toBe("2 cameras are ready: open each one's bottles and settings.");
  });

  it('a missing bottle comes before a low one, both named; low alone counts its bottles', () => {
    const cams = [camera({
      bottles: [bottle({ state: 'missing', percent: null, present: false }), bottle({ slot: 'B2', name: 'Blue', state: 'low', percent: 9 }), bottle({ slot: 'B3', name: 'Green' })],
    })];
    expect(summaryWords(cams, t, tn)).toEqual({
      tone: 'bad', badge: 1, title: '1 bottle is missing', subtitle: 'Red: put the bottle back in its place. 1 more is low.',
    });
    const low = [camera({ bottles: [bottle({ state: 'low', percent: 12 }), bottle({ slot: 'B2', name: 'Blue', state: 'low', percent: 9 })] })];
    expect(summaryWords(low, t, tn)).toEqual({
      tone: 'warn', badge: 2, title: '2 bottles need a refill', subtitle: 'Red, Blue: refill before the colour runs out.',
    });
  });

  it('a camera off only matters once every bottle is fine; nothing read yet waits; else all good with the lowest named', () => {
    expect(summaryWords([camera({ online: false })], t, tn)).toMatchObject({ tone: 'warn', title: '1 camera is offline' });
    expect(summaryWords([camera({ online: false, bottles: [bottle({ state: 'low' })] })], t, tn).tone).toBe('warn');
    expect(summaryWords([camera({ online: false, bottles: [bottle({ state: 'low' })] })], t, tn).title).toBe('1 bottle needs a refill');
    expect(summaryWords([camera({ bottles: [bottle({ state: 'unknown', percent: null, present: null, at: null })] })], t, tn))
      .toMatchObject({ tone: 'idle', title: 'Waiting for the first reading' });
    const good = summaryWords([camera({ bottles: [bottle(), bottle({ slot: 'B2', name: 'Blue', percent: 40.4 })] })], t, tn);
    expect(good).toEqual({ tone: 'good', title: 'Every dye bottle is topped up', subtitle: '2 watched · lowest Blue at 40%' });
    expect(summaryWords([camera({ bottles: [bottle({ percent: null })] })], t, tn).subtitle).toBe('1 bottle watched');
  });
});

describe('the words of a bottle, an event, a state, a picture and a camera', () => {
  it('bottleWords', () => {
    expect(bottleWords(bottle({ state: 'missing' }), t)).toBe('Missing: no bottle in its place');
    expect(bottleWords(bottle({ state: 'low', percent: 12.4 }), t)).toBe('Low: 12% left, refill it');
    expect(bottleWords(bottle({ state: 'low', percent: null }), t)).toBe('Low: refill it');
    expect(bottleWords(bottle({ percent: 72 }), t)).toBe('72% full');
    expect(bottleWords(bottle({ percent: null }), t)).toBe('OK');
    expect(bottleWords(bottle({ state: 'unknown' }), t)).toBe('No reading yet');
  });

  it('eventWords: what the bottle did, by its name or its slot', () => {
    expect(eventWords(event(), t)).toBe('Red: low, 12% left');
    expect(eventWords(event({ percent: null }), t)).toBe('Red: low');
    expect(eventWords(event({ state: 'missing' }), t)).toBe('Red: bottle missing');
    expect(eventWords(event({ state: 'ok', prev: 'low', percent: 80 }), t)).toBe('Red: refilled to 80%');
    expect(eventWords(event({ state: 'ok', prev: 'missing', percent: 80 }), t)).toBe('Red: bottle back, 80%');
    expect(eventWords(event({ state: 'ok', prev: null, percent: 80 }), t)).toBe('Red: OK, 80%');
    expect(eventWords(event({ state: 'unknown', name: null }), t)).toBe('B1: no reading');
  });

  it('levelWord, pictureKindWord, cameraTitle', () => {
    expect(['ok', 'low', 'missing', 'unknown'].map((s) => levelWord(s as never, t))).toEqual(['OK', 'Low', 'Missing', 'No reading yet']);
    expect(['alert', 'snap', 'periodic'].map((k) => pictureKindWord(k as never, t))).toEqual(['Alert picture', 'Picture on request', 'Routine picture']);
    expect(cameraTitle(camera(), t)).toBe('Dye camera at Loom 3');
    expect(cameraTitle(camera({ machine_name: null }), t)).toBe('Dye camera cam-a1b2c3');
  });
});

describe('box geometry, in the reference picture\'s pixels', () => {
  it('fractions of the picture both ways, points clamped into it', () => {
    expect(rectToFrac({ x: 160, y: 120, w: 320, h: 240 }, REF)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(fracToPoint(0.5, 0.5, REF)).toEqual({ x: 320, y: 240 });
    expect(fracToPoint(-1, 2, REF)).toEqual({ x: 0, y: 480 });
  });

  it('a box stays inside the picture and no smaller than the camera can measure', () => {
    expect(clampRect({ x: -10, y: -10, w: 2, h: 2 }, REF)).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(clampRect({ x: 630, y: 470, w: 100, h: 100 }, REF)).toEqual({ x: 540, y: 380, w: 100, h: 100 });
    expect(clampRect({ x: 10.4, y: 10.6, w: 700, h: 500 }, REF)).toEqual({ x: 0, y: 0, w: 640, h: 480 });
  });

  it('a drag makes a box either way round; a tap makes none', () => {
    expect(rectFromDrag({ x: 200, y: 300 }, { x: 100, y: 100 }, REF)).toEqual({ x: 100, y: 100, w: 100, h: 200 });
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 15, y: 40 }, REF)).toBeNull();
    expect(rectFromDrag({ x: 10, y: 10 }, { x: 40, y: 20 }, REF)).toBeNull();
  });

  it('finds the box, or its corner handle, under a point: the last drawn first', () => {
    const boxes = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 }];
    expect(hitBox(boxes, { x: 60, y: 60 })).toBe(1);
    expect(hitBox(boxes, { x: 10, y: 10 })).toBe(0);
    expect(hitBox(boxes, { x: 300, y: 300 })).toBe(-1);
    expect(hitCorner(boxes, { x: 148, y: 152 }, 6)).toBe(1);
    expect(hitCorner(boxes, { x: 100, y: 100 }, 6)).toBe(0);
    expect(hitCorner(boxes, { x: 60, y: 60 }, 6)).toBe(-1);
  });

  it('moves and resizes within the picture', () => {
    expect(moveRect({ x: 600, y: 0, w: 80, h: 100 }, 100, -5, REF)).toEqual({ x: 560, y: 0, w: 80, h: 100 });
    expect(resizeRect({ x: 100, y: 100, w: 50, h: 50 }, { x: 300, y: 400 }, REF)).toEqual({ x: 100, y: 100, w: 200, h: 300 });
    expect(resizeRect({ x: 100, y: 100, w: 50, h: 50 }, { x: 20, y: 20 }, REF)).toEqual({ x: 100, y: 100, w: 4, h: 8 });
  });

  it('slots B1..B8 in order; a ninth bottle has no slot', () => {
    expect(CAM_SLOTS).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']);
    expect(nextSlot([])).toBe('B1');
    expect(nextSlot([{ slot: 'B1' }, { slot: 'B3' }])).toBe('B2');
    const full = CAM_SLOTS.map((slot) => box({ slot }));
    expect(nextSlot(full)).toBeNull();
    expect(newBox([], { x: 1, y: 2, w: 30, h: 40 })).toEqual({ slot: 'B1', name: 'B1', x: 1, y: 2, w: 30, h: 40, low: 15, cap: 20 });
    expect(newBox(full, { x: 1, y: 2, w: 30, h: 40 })).toBeNull();
  });
});

describe('boxProblem: what the server would refuse, said first', () => {
  it('fine boxes pass; the rest are named by their bottle', () => {
    expect(boxProblem([box(), box({ slot: 'B2', name: 'Blue', x: 300 })], REF, t)).toBeNull();
    expect(boxProblem([box(), box({ name: 'Blue' })], REF, t)).toBe('Blue: its slot is used twice');
    expect(boxProblem([box({ slot: 'B9' })], REF, t)).toBe('Red: its slot is used twice');
    expect(boxProblem([box({ name: 'A name that is far too long for it' })], REF, t)).toBe('A name that is far too long for it: a name of at most 23 characters');
    expect(boxProblem([box({ x: 600 })], REF, t)).toBe('Red: its box runs off the picture');
    expect(boxProblem([box({ w: 2 })], REF, t)).toBe('Red: its box runs off the picture');
    expect(boxProblem([box({ y: 10.5 })], REF, t)).toBe('Red: its box runs off the picture');
    expect(boxProblem([box({ low: 0 })], REF, t)).toBe('Red: the refill line is a whole number from 1 to 99');
    expect(boxProblem([box({ cap: 4 })], REF, t)).toBe('Red: the cap zone is a whole number from 5 to 50');
    expect(boxProblem([...CAM_SLOTS, 'B9'].map((slot) => box({ slot })), REF, t)).toBe('At most 8 bottles');
    expect(boxProblem([box({ name: '   ' })], REF, t)).toBeNull();
  });

  it('settingsProblem mirrors the server\'s ranges', () => {
    const ok = { period_s: 5, need: 3, pic_every_s: 600, dark: 110, bright: 150, flip: false, mirror: false };
    expect(settingsProblem(ok, t)).toBeNull();
    expect(settingsProblem({ ...ok, period_s: 0 }, t)).toBe('Measure every: a whole number of seconds from 1 to 3600');
    expect(settingsProblem({ ...ok, need: 21 }, t)).toBe('Readings that must agree: a whole number from 1 to 20');
    expect(settingsProblem({ ...ok, pic_every_s: -1 }, t)).toBe('Routine picture: a whole number of seconds up to 86400, 0 for none');
    expect(settingsProblem({ ...ok, dark: 256 }, t)).toBe('Thresholds are whole numbers from 0 to 255');
    expect(settingsProblem({ ...ok, dark: 150 }, t)).toBe('The dark threshold must be below the backlight threshold');
  });

  it('cleanBoxes trims names and names an unnamed bottle by its slot', () => {
    expect(cleanBoxes([box({ name: '  Dark red ' }), box({ slot: 'B2', name: '   ' })]).map((b) => b.name)).toEqual(['Dark red', 'B2']);
  });
});

describe('addresses and keys', () => {
  it('a picture is fetched through the site\'s own API proxy', () => {
    expect(pictureUrl('mill 1', 'cam-a1b2c3', 42)).toBe('/api/v1/factories/mill%201/bottles/cam-a1b2c3/pictures/42');
  });

  it('query keys', () => {
    expect(bottlesQueryKey('mill')).toEqual(['bottles', 'mill']);
  });
});
