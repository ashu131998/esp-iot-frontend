/**
 * A factory's cameras (the Cameras page; query-api src/cam-routes.js; firmware target "cam"): each one's last picture,
 * its live view (lib/live.ts), whether something is in front of it, and its events with their pictures. Something in
 * front of a camera (a hand on the lens, a cover) alerts the factory's admins unless switched off for that camera.
 * The dye bottles the cameras began with were dropped (2026-11).
 *
 * Pure, so tested: the words of the page.
 */
import type { Tone } from '@/components/ui/simple';
import type { Translate, TranslatePlural } from '@/lib/i18n/translate';

export type PictureKind = 'alert' | 'snap' | 'periodic';

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
  /** Something is in front of it now. */
  view: 'blocked' | 'clear';
  fw: string | null;
  cfg_version: number;
  settings: CamSettings;
  /** Something in front of it alerts the factory's admins. */
  view_alert: boolean;
  last_picture: CamPicture | null;
}

export interface CamerasResponse {
  cameras: Camera[];
}

/** Something came in front of the camera (blocked), or the view is clear again (ok); with its picture when one arrived. */
export interface CameraEvent {
  id: number;
  slot: string;
  state: string;
  prev: string | null;
  ev: number | null;
  occurred_at: string;
  picture_id: number | null;
}

/** What the settings pop-up sends: the camera's settings, the machine it is at, whether something in front alerts. */
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

export function pictureKindWord(kind: PictureKind, t: Translate): string {
  switch (kind) {
    case 'alert': return t('Something in front of it');
    case 'snap': return t('Picture on request');
    default: return t('Routine picture');
  }
}

export function eventWords(e: Pick<CameraEvent, 'state'>, t: Translate): string {
  return e.state === 'blocked' ? t('Something in front of the camera') : t('The view is clear again');
}

export const EVENT_TONE = (e: Pick<CameraEvent, 'state'>): Tone => (e.state === 'blocked' ? 'bad' : 'good');

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
