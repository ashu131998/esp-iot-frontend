/**
 * A factory's cameras (the Cameras page; query-api src/cam-routes.js; firmware target "cam"): each one's last picture,
 * its live view (lib/live.ts), and what it saw with the pictures. Since firmware 2.9.8 a camera is a gate camera: it
 * sends a picture of whatever moves in front of it, and pretrained AI models on the server tell a truck or a hand in
 * it (query-api src/vision), which alerts the factory's admins unless switched off for that camera. Firmware 2.9.6
 * told "something in front of the camera" itself. The dye bottles the cameras began with were dropped (2026-11).
 *
 * Pure, so tested: the words of the page.
 */
import type { Tone } from '@/components/ui/simple';
import type { Translate, TranslatePlural } from '@/lib/i18n/translate';

export type PictureKind = 'alert' | 'snap' | 'periodic' | 'motion';

/** The camera's own settings (the firmware's "cam" object), as the server keeps them. */
export interface CamSettings {
  exposure: number;
  gain: number;
  flip: boolean;
  mirror: boolean;
  /** A picture this often (seconds); 0: only on events and requests. */
  pic_every_s: number;
  snap: number;
}

export interface CamPicture {
  id: number;
  kind: PictureKind;
  slot: string | null;
  state: string | null;
  ev: number | null;
  taken_at: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface Camera {
  board_id: string;
  line_id: string;
  /** The machine it is at (alerts name it); null until set on the page. */
  machine_id: string | null;
  machine_name: string | null;
  online: boolean;
  last_beat_at: string | null;
  /** The camera module's own word in its heartbeats ("ok", or what failed). */
  camera: string | null;
  /** Something is in front of it now (firmware 2.9.6; a gate camera's movement is not shown). */
  view: 'blocked' | 'clear';
  fw: string | null;
  cfg_version: number;
  settings: CamSettings;
  /** A truck or a hand it sees (2.9.6: something in front of it) alerts the factory's admins. */
  view_alert: boolean;
  last_picture: CamPicture | null;
}

export interface CamerasResponse {
  cameras: Camera[];
}

/**
 * What a camera saw, with its picture when one arrived: a truck or a hand the models found (state "truck" / "hand",
 * id "s<n>"), or, from firmware 2.9.6, something in front of it (blocked) and the view clear again (ok).
 */
export interface CameraEvent {
  id: string | number;
  slot: string;
  state: string;
  prev: string | null;
  ev: number | null;
  occurred_at: string;
  picture_id: number | null;
}

/** What the settings pop-up sends: the camera's settings, the machine it is at, whether what it sees alerts. */
export interface CamSettingsBody {
  cam: Pick<CamSettings, 'flip' | 'mirror' | 'pic_every_s' | 'exposure' | 'gain'>;
  machine_id: string | null;
  view_alert: boolean;
}

export const camerasQueryKey = (factoryId: string) => ['cameras', factoryId] as const;
export const cameraEventsQueryKey = (factoryId: string, boardId: string) => ['camera-events', factoryId, boardId] as const;

/** A picture's address on this site (the proxy adds the sign-in; the API serves the JPEG). */
export function pictureUrl(factoryId: string, boardId: string, pictureId: number): string {
  return `/api/v1/factories/${encodeURIComponent(factoryId)}/cameras/${encodeURIComponent(boardId)}/pictures/${pictureId}`;
}

export function cameraTitle(c: Pick<Camera, 'board_id' | 'machine_name'>, t: Translate): string {
  return c.machine_name ? t('Camera at {machine}', { machine: c.machine_name }) : t('Camera {id}', { id: c.board_id });
}

/** What a picture is: what was seen in it (an event's), a movement, one asked for, the routine one. */
export function pictureKindWord(p: Pick<CamPicture, 'kind' | 'state'>, t: Translate): string {
  switch (p.kind) {
    case 'alert': return p.state === 'truck' || p.state === 'hand' ? eventWords(p, t) : t('Something in front of it');
    case 'motion': return t('Movement');
    case 'snap': return t('Picture on request');
    default: return t('Routine picture');
  }
}

export function eventWords(e: { state: string | null }, t: Translate): string {
  switch (e.state) {
    case 'truck': return t('A truck');
    case 'hand': return t('A hand in front of the camera');
    case 'blocked': return t('Something in front of the camera');
    default: return t('The view is clear again');
  }
}

export const EVENT_TONE = (e: Pick<CameraEvent, 'state'>): Tone => {
  switch (e.state) {
    case 'truck': return 'warn';
    case 'hand':
    case 'blocked': return 'bad';
    default: return 'good';
  }
};

/** How often a camera sends a picture: the choices offered (seconds; 0 = only on events and requests). */
export const PICTURE_EVERY = [0, 300, 600, 1800, 3600] as const;

export function pictureEveryWord(s: number, t: Translate, tn: TranslatePlural): string {
  if (s <= 0) return t('Only when something happens or I ask');
  if (s < 3600) return tn(Math.round(s / 60), 'Every minute', 'Every {count} minutes', { count: Math.round(s / 60) });
  return tn(Math.round(s / 3600), 'Every hour', 'Every {count} hours', { count: Math.round(s / 3600) });
}

export interface Words {
  tone: Tone;
  badge?: number;
  title: string;
  subtitle: string;
}

/** The one sentence to read first, worst thing first: something in front of a camera, a camera off, all well. */
export function summaryWords(cameras: Camera[], t: Translate, tn: TranslatePlural): Words {
  if (cameras.length === 0) {
    return { tone: 'idle', title: t('No camera yet'), subtitle: t('Once a camera is claimed into this factory, it shows here.') };
  }
  const names = (list: Camera[]) => list.map((c) => cameraTitle(c, t)).join(', ');
  const blocked = cameras.filter((c) => c.online && c.view === 'blocked');
  if (blocked.length > 0) {
    return {
      tone: 'bad',
      badge: blocked.length,
      title: tn(blocked.length, 'Something is in front of {count} camera', 'Something is in front of {count} cameras', { count: blocked.length }),
      subtitle: t('{names}: check that nobody is blocking it.', { names: names(blocked) }),
    };
  }
  const offline = cameras.filter((c) => !c.online);
  if (offline.length > 0) {
    return {
      tone: 'warn',
      badge: offline.length,
      title: tn(offline.length, '{count} camera is offline', '{count} cameras are offline', { count: offline.length }),
      subtitle: t('{names}: check its power and WiFi.', { names: names(offline) }),
    };
  }
  return {
    tone: 'good',
    title: tn(cameras.length, 'The camera is on', 'All {count} cameras are on', { count: cameras.length }),
    subtitle: t('Watch one live, or look back at what it saw.'),
  };
}
