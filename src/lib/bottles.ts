/**
 * The dye-bottle cameras (query-api src/cam-routes.js; firmware target "cam"): a camera fixed in front of a
 * machine's transparent dye bottles against a backlight. On the Bottles page the user draws one box per bottle
 * on the camera's picture and names the colour; the camera measures the dark band in each box every few seconds
 * and says ok / low / missing; a low or missing bottle alerts the machine's operators with the picture.
 *
 * Pure, so tested: the words of the page, the box geometry of the editor, and the same checks the server makes
 * on boxes (boards.js normalizeCamSettings), so a bad box is refused before it is sent.
 */
import type { Tone } from '@/components/ui/simple';
import type { Translate, TranslatePlural } from '@/lib/i18n/translate';

export type LevelState = 'ok' | 'low' | 'missing' | 'unknown';
export type PictureKind = 'alert' | 'snap' | 'periodic';

/** As many bottles as the firmware watches (config_types.h MAX_BOXES), in slots B1..B8. */
export const CAM_MAX_BOXES = 8;
export const CAM_SLOTS: readonly string[] = Array.from({ length: CAM_MAX_BOXES }, (_, i) => `B${i + 1}`);
/** The smallest box the camera can measure (pixels of the reference picture). */
export const MIN_BOX_W = 4;
export const MIN_BOX_H = 8;
/** A drag shorter than this is a tap, not a box. */
const DRAG_MIN_W = 8;
const DRAG_MIN_H = 16;
export const DEFAULT_LOW = 15;
export const DEFAULT_CAP = 20;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One bottle's box as the camera reads it: pixels of a ref_w × ref_h picture, with its refill line (%) and cap zone (%). */
export interface CamBox extends Rect {
  slot: string;
  name: string;
  low: number;
  cap: number;
}

/** The camera's settings (the firmware's "cam" object), as the server keeps them. */
export interface CamSettings {
  ref_w: number;
  ref_h: number;
  period_s: number;
  need: number;
  hyst: number;
  dark: number;
  bright: number;
  exposure: number;
  gain: number;
  flip: boolean;
  mirror: boolean;
  quality: number;
  pic_every_s: number;
  snap: number;
}

export interface Bottle {
  slot: string;
  name: string;
  low: number;
  cap: number;
  box: Rect;
  state: LevelState;
  percent: number | null;
  present: boolean | null;
  /** When the camera last said so; null before its first reading. */
  at: string | null;
}

export interface CamPicture {
  id: number;
  kind: PictureKind;
  slot: string | null;
  state: LevelState | null;
  percent: number | null;
  ev: number | null;
  taken_at: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface BottleCamera {
  board_id: string;
  line_id: string;
  /** The machine the bottles are at (its operators get the alerts); null until set on the page. */
  machine_id: string | null;
  machine_name: string | null;
  online: boolean;
  last_beat_at: string | null;
  /** The camera module's own word in its heartbeats ("ok", or what failed). */
  camera: string | null;
  fw: string | null;
  cfg_version: number;
  settings: CamSettings;
  bottles: Bottle[];
  last_picture: CamPicture | null;
}

export interface BottlesResponse {
  cameras: BottleCamera[];
}

/** A state change the camera reported, with its picture when one arrived. */
export interface LevelEvent {
  id: number;
  slot: string;
  name: string | null;
  state: LevelState;
  prev: LevelState | null;
  percent: number | null;
  present: boolean | null;
  low: number | null;
  ev: number | null;
  occurred_at: string;
  picture_id: number | null;
}

/** PUT /v1/factories/:id/bottles/:board/settings. */
export interface CamSettingsBody {
  cam: Partial<CamSettings> & { boxes: CamBox[] };
  /** Left out: unchanged. null: at no machine. */
  machine_id?: string | null;
}

export const bottlesQueryKey = (factoryId: string) => ['bottles', factoryId] as const;
export const bottleEventsQueryKey = (factoryId: string, boardId: string) => ['bottle-events', factoryId, boardId] as const;

/** A picture's address on this site (the proxy adds the sign-in; the API serves the JPEG). */
export function pictureUrl(factoryId: string, boardId: string, pictureId: number): string {
  return `/api/v1/factories/${encodeURIComponent(factoryId)}/bottles/${encodeURIComponent(boardId)}/pictures/${pictureId}`;
}

export const LEVEL_TONE: Record<LevelState, Tone> = { ok: 'good', low: 'warn', missing: 'bad', unknown: 'idle' };

export function levelWord(state: LevelState, t: Translate): string {
  switch (state) {
    case 'ok': return t('OK');
    case 'low': return t('Low');
    case 'missing': return t('Missing');
    default: return t('No reading yet');
  }
}

export function pictureKindWord(kind: PictureKind, t: Translate): string {
  switch (kind) {
    case 'alert': return t('Alert picture');
    case 'snap': return t('Picture on request');
    default: return t('Routine picture');
  }
}

const pct = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v));
const bottleName = (b: { name: string | null; slot: string }): string => b.name || b.slot;

/** The camera's name on the page: by the machine its bottles are at, else by its id. */
export function cameraTitle(c: Pick<BottleCamera, 'board_id' | 'machine_name'>, t: Translate): string {
  return c.machine_name ? t('Dye camera at {machine}', { machine: c.machine_name }) : t('Dye camera {id}', { id: c.board_id });
}

export interface Words {
  tone: Tone;
  badge?: number;
  title: string;
  subtitle: string;
}

/** The one sentence to read first, worst thing first: missing bottles, low bottles, a camera off, nothing read yet. */
export function summaryWords(cameras: BottleCamera[], t: Translate, tn: TranslatePlural): Words {
  if (cameras.length === 0) {
    return { tone: 'idle', title: t('No dye camera yet'), subtitle: t('Once a camera is claimed into this factory, its bottles show here.') };
  }
  const bottles = cameras.flatMap((c) => c.bottles);
  if (bottles.length === 0) {
    return {
      tone: 'idle',
      title: t('Draw a box around each bottle to start'),
      subtitle: tn(cameras.length, '{count} camera is ready: open its bottles and settings.', '{count} cameras are ready: open each one\'s bottles and settings.', { count: cameras.length }),
    };
  }
  const missing = bottles.filter((b) => b.state === 'missing');
  const low = bottles.filter((b) => b.state === 'low');
  const names = (list: Bottle[]) => list.map(bottleName).join(', ');
  if (missing.length > 0) {
    const also = low.length > 0 ? ' ' + tn(low.length, '{count} more is low.', '{count} more are low.', { count: low.length }) : '';
    return {
      tone: 'bad',
      badge: missing.length,
      title: tn(missing.length, '{count} bottle is missing', '{count} bottles are missing', { count: missing.length }),
      subtitle: t('{names}: put the bottle back in its place.', { names: names(missing) }) + also,
    };
  }
  if (low.length > 0) {
    return {
      tone: 'warn',
      badge: low.length,
      title: tn(low.length, '{count} bottle needs a refill', '{count} bottles need a refill', { count: low.length }),
      subtitle: t('{names}: refill before the colour runs out.', { names: names(low) }),
    };
  }
  const offline = cameras.filter((c) => !c.online).length;
  if (offline > 0) {
    return {
      tone: 'warn',
      title: tn(offline, '{count} camera is offline', '{count} cameras are offline', { count: offline }),
      subtitle: t('Its levels are from before it went off. Check its power and WiFi.'),
    };
  }
  const read = bottles.filter((b) => b.state !== 'unknown');
  if (read.length === 0) {
    return { tone: 'idle', title: t('Waiting for the first reading'), subtitle: t('The camera measures every few seconds; levels show once it has looked.') };
  }
  const lowest = read.filter((b) => b.percent != null).sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
  return {
    tone: 'good',
    title: t('Every dye bottle is topped up'),
    subtitle: lowest
      ? t('{count} watched · lowest {name} at {percent}%', { count: read.length, name: bottleName(lowest), percent: pct(lowest.percent) })
      : tn(read.length, '{count} bottle watched', '{count} bottles watched', { count: read.length }),
  };
}

/** One bottle's line under its bar. */
export function bottleWords(b: Bottle, t: Translate): string {
  const percent = pct(b.percent);
  switch (b.state) {
    case 'missing': return t('Missing: no bottle in its place');
    case 'low': return percent == null ? t('Low: refill it') : t('Low: {percent}% left, refill it', { percent });
    case 'ok': return percent == null ? t('OK') : t('{percent}% full', { percent });
    default: return t('No reading yet');
  }
}

/** A state change as one line: what the bottle did. */
export function eventWords(e: LevelEvent, t: Translate): string {
  const name = bottleName(e);
  const percent = pct(e.percent);
  switch (e.state) {
    case 'low':
      return percent == null ? t('{name}: low', { name }) : t('{name}: low, {percent}% left', { name, percent });
    case 'missing':
      return t('{name}: bottle missing', { name });
    case 'ok':
      if (e.prev === 'missing') return t('{name}: bottle back, {percent}%', { name, percent: percent ?? 0 });
      if (e.prev === 'low') return t('{name}: refilled to {percent}%', { name, percent: percent ?? 0 });
      return t('{name}: OK, {percent}%', { name, percent: percent ?? 0 });
    default:
      return t('{name}: no reading', { name });
  }
}

// --- box geometry (the editor works in the reference picture's pixels; the picture is shown scaled) ---

export type Ref = Pick<CamSettings, 'ref_w' | 'ref_h'>;

/** A box as fractions of the picture (0..1), for CSS percentages over a picture of any shown size. */
export function rectToFrac(r: Rect, ref: Ref): Rect {
  return { x: r.x / ref.ref_w, y: r.y / ref.ref_h, w: r.w / ref.ref_w, h: r.h / ref.ref_h };
}

/** A point on the shown picture (fractions 0..1) as reference pixels. */
export function fracToPoint(fx: number, fy: number, ref: Ref): { x: number; y: number } {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return { x: Math.round(clamp01(fx) * ref.ref_w), y: Math.round(clamp01(fy) * ref.ref_h) };
}

/** The box kept inside the picture and no smaller than the camera can measure. */
export function clampRect(r: Rect, ref: Ref): Rect {
  const w = Math.min(ref.ref_w, Math.max(MIN_BOX_W, Math.round(r.w)));
  const h = Math.min(ref.ref_h, Math.max(MIN_BOX_H, Math.round(r.h)));
  const x = Math.min(ref.ref_w - w, Math.max(0, Math.round(r.x)));
  const y = Math.min(ref.ref_h - h, Math.max(0, Math.round(r.y)));
  return { x, y, w, h };
}

/** The box between two points of a drag, either way round; null when the drag was only a tap. */
export function rectFromDrag(a: { x: number; y: number }, b: { x: number; y: number }, ref: Ref): Rect | null {
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  if (w < DRAG_MIN_W || h < DRAG_MIN_H) return null;
  return clampRect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h }, ref);
}

/** The index of the box under a point (the last drawn wins when they overlap), -1 for none. */
export function hitBox(boxes: readonly Rect[], p: { x: number; y: number }): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return i;
  }
  return -1;
}

/** The corner handle (bottom right) under a point: within `grip` pixels of it. */
export function hitCorner(boxes: readonly Rect[], p: { x: number; y: number }, grip: number): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (Math.abs(p.x - (b.x + b.w)) <= grip && Math.abs(p.y - (b.y + b.h)) <= grip) return i;
  }
  return -1;
}

export function moveRect(r: Rect, dx: number, dy: number, ref: Ref): Rect {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, ref);
}

/** The box resized from its top-left corner to a new bottom-right corner. */
export function resizeRect(r: Rect, corner: { x: number; y: number }, ref: Ref): Rect {
  return clampRect({ x: r.x, y: r.y, w: corner.x - r.x, h: corner.y - r.y }, ref);
}

/** The first free slot, null when every one is taken. */
export function nextSlot(boxes: readonly { slot: string }[]): string | null {
  const used = new Set(boxes.map((b) => b.slot));
  return CAM_SLOTS.find((s) => !used.has(s)) ?? null;
}

/** A new bottle in the next free slot, named after it until the user names the colour. */
export function newBox(boxes: readonly CamBox[], rect: Rect): CamBox | null {
  const slot = nextSlot(boxes);
  if (!slot) return null;
  return { slot, name: slot, ...rect, low: DEFAULT_LOW, cap: DEFAULT_CAP };
}

const whole = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** What the server would refuse (boards.js normalizeCamSettings), said before sending; null when the boxes are fine. */
export function boxProblem(boxes: readonly CamBox[], ref: Ref, t: Translate): string | null {
  if (boxes.length > CAM_MAX_BOXES) return t('At most {count} bottles', { count: CAM_MAX_BOXES });
  const seen = new Set<string>();
  for (const b of boxes) {
    const name = b.name.trim() || b.slot;
    if (!CAM_SLOTS.includes(b.slot) || seen.has(b.slot)) return t('{name}: its slot is used twice', { name });
    seen.add(b.slot);
    if (name.length > 23) return t('{name}: a name of at most 23 characters', { name });
    if (!whole(b.x, 0, ref.ref_w - MIN_BOX_W) || !whole(b.y, 0, ref.ref_h - MIN_BOX_H) || !whole(b.w, MIN_BOX_W, ref.ref_w) || !whole(b.h, MIN_BOX_H, ref.ref_h)
      || b.x + b.w > ref.ref_w || b.y + b.h > ref.ref_h) {
      return t('{name}: its box runs off the picture', { name });
    }
    if (!whole(b.low, 1, 99)) return t('{name}: the refill line is a whole number from 1 to 99', { name });
    if (!whole(b.cap, 5, 50)) return t('{name}: the cap zone is a whole number from 5 to 50', { name });
  }
  return null;
}

/** The camera settings the editor offers, checked as the server checks them (the rest keep their stored values). */
export type EditableSettings = Pick<CamSettings, 'period_s' | 'need' | 'pic_every_s' | 'dark' | 'bright' | 'flip' | 'mirror'>;

export function settingsProblem(s: EditableSettings, t: Translate): string | null {
  if (!whole(s.period_s, 1, 3600)) return t('Measure every: a whole number of seconds from 1 to 3600');
  if (!whole(s.need, 1, 20)) return t('Readings that must agree: a whole number from 1 to 20');
  if (!whole(s.pic_every_s, 0, 86400)) return t('Routine picture: a whole number of seconds up to 86400, 0 for none');
  if (!whole(s.dark, 0, 255) || !whole(s.bright, 0, 255)) return t('Thresholds are whole numbers from 0 to 255');
  if (s.dark >= s.bright) return t('The dark threshold must be below the backlight threshold');
  return null;
}

/** The boxes as sent: names trimmed, an empty name is its slot. */
export function cleanBoxes(boxes: readonly CamBox[]): CamBox[] {
  return boxes.map((b) => ({ ...b, name: (b.name.trim() || b.slot).slice(0, 23) }));
}
