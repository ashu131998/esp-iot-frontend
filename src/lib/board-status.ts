/**
 * What the staff Nodes page shows about a board, from its latest heartbeat summary
 * (stored by the consumer; fields added over firmware versions, so any may be missing).
 */

import { format } from 'date-fns';

import type { BoardSettings } from '@/lib/board-settings';

export interface BoardBeat {
  fw?: string;
  uptime_s?: number;
  synced?: boolean;
  /** Where its time comes from (firmware 2.1.1+): none, estimated, ntp or server. */
  clock?: string;
  boot_count?: number;
  reset_reason?: string;
  q_bytes?: number;
  rtc?: string;
  rtc_status?: number;
  rtc_set?: boolean;
  vin_v?: number;
  /** Which MQTT login it connected with (firmware 2.1+). */
  login?: string;
  /** Its hardware, and a remote update in progress (firmware 2.2+). */
  hw?: string;
  ota_state?: string;
  ota_version?: string;
  ota_error?: string;
  ota_pct?: number;
  /** Where its queue is (firmware 2.3+): ext = REV B's 16 MB chip, int = its own flash. */
  qloc?: string;
  q_cap?: number;
  /** Lifetime: unconfirmed bytes dropped from a full queue (oldest first). */
  q_dropped?: number;
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/** A board on the staff Boards page (GET /v1/admin/boards). */
export interface AdminBoard {
  board_id: string;
  factory_id: string | null;
  line_id: string | null;
  /** When it joined: the server first heard from it, or set it up here if that came first. */
  onboarded_at: string | null;
  last_beat_at: string | null;
  beat: BoardBeat | null;
  /** What the dashboard last sent it (null: never set from here). */
  settings: BoardSettings | null;
  cfg_version: number | null;
  settings_sent_at: string | null;
  /** A login of its own has been issued (it switches to it with firmware 2.1+). */
  own_login: boolean;
  login_issued_at: string | null;
  /** The firmware update last offered to it from here (null: none, or withdrawn). */
  ota_version: string | null;
  ota_requested_at: string | null;
  /** From the broker: connected now, and with which login (null: broker unknown / never connected). */
  online: boolean | null;
  login: 'own' | 'shared' | null;
  ip: string | null;
  connected_at: number | string | null;
}

/** The server's services on the broker (GET /v1/admin/boards → logins.services). */
export interface ServiceLogin {
  service: string;
  username: string;
  online: boolean;
  login: 'own' | 'shared' | null;
}

/** A client on the shared fleet login: what restricting it would do to it depends on its kind. */
export interface SharedLoginClient {
  clientid: string;
  ip: string | null;
  kind: 'board' | 'new-board' | 'service' | 'other';
}

export interface BrokerLogins {
  services: ServiceLogin[];
  shared: { username: string; restricted: boolean; clients: SharedLoginClient[] };
}

const SERVICE_NAMES: Record<string, string> = { bridge: 'Data bridge', mock: 'Demo data producer' };

export function serviceName(service: string): string {
  return SERVICE_NAMES[service] ?? service;
}

/** A server service's broker login: its own (only its topics), or still the shared one. */
export function serviceLoginStatus(s: ServiceLogin): StatusCell {
  const name = serviceName(s.service);
  if (!s.online) {
    return { label: 'Not connected', tone: s.service === 'bridge' ? 'bad' : 'neutral', detail: `${name} is not connected to the broker` };
  }
  if (s.login === 'own') return { label: 'Own login', tone: 'good', detail: `${name} connects as ${s.username}: only its own topics` };
  return { label: 'Shared login', tone: 'warn', detail: `${name} still uses the shared login; the server sets up its own when it starts` };
}

export const SHARED_CLIENT_KIND: Record<SharedLoginClient['kind'], string> = {
  'new-board': 'New board: keeps working',
  board: 'Board: cut off until it has its own login',
  service: 'Server service: cut off',
  other: 'Other client (a tool): cut off',
};

/**
 * What restricting the shared login would do now: refused while a service still needs it
 * (the bridge on it, or not connected: all data would stop); which clients it cuts off.
 */
export function restrictionPlan(l: BrokerLogins): { blockedBy: string[]; cutOff: SharedLoginClient[] } {
  const blockedBy = l.services
    .filter((s) => s.login === 'shared' || (s.service === 'bridge' && !s.online))
    .map((s) => (s.online ? `${serviceName(s.service)} still uses it` : `${serviceName(s.service)} is not connected`));
  return { blockedBy, cutOff: l.shared.clients.filter((c) => c.kind !== 'new-board') };
}

/** Which MQTT login the board uses, and whether a login of its own is waiting for it. */
export function loginStatus(b: Pick<AdminBoard, 'login' | 'own_login'>): StatusCell {
  if (b.login === 'own') return { label: 'Own', tone: 'good', detail: 'Connects with its own login: only its own topics' };
  if (b.own_login) {
    return { label: 'Issued, not in use', tone: 'warn', detail: 'Its own login was sent; the board switches with firmware 2.1+ (or has not been online since)' };
  }
  if (b.login === 'shared') return { label: 'Shared', tone: 'warn', detail: 'Uses the shared fleet login' };
  return { label: '—', tone: 'neutral', detail: 'Not connected to the broker since it restarted' };
}

export interface StatusCell {
  label: string;
  tone: Tone;
  /** Longer explanation for a tooltip. */
  detail: string;
}

const NONE: StatusCell = { label: '—', tone: 'neutral', detail: 'Not reported by this firmware' };

/**
 * The battery clock as the board found it at its last start-up. "stopped" after a real
 * power cut means no battery power reached it; after a restart with the power on (an
 * update) it only means it had not been set since an earlier cut.
 */
export function batteryClock(beat: BoardBeat | null | undefined): StatusCell {
  const rtc = beat?.rtc;
  if (!rtc) return NONE;
  if (rtc === 'kept') return { label: 'OK', tone: 'good', detail: 'Kept the time through the last power-up' };
  if (rtc === 'none') return { label: 'No clock chip', tone: 'neutral', detail: 'This board has no battery clock' };
  if (rtc === 'wrong') return { label: 'Wrong time', tone: 'warn', detail: 'The battery clock held a time that cannot be right' };
  if (rtc === 'stopped') {
    const powerCut = beat?.reset_reason === 'power_on' || beat?.reset_reason === 'brownout';
    return powerCut
      ? { label: 'No battery', tone: 'bad', detail: 'Lost the time in the last power cut: battery missing, flat or not connected' }
      : { label: 'Not checked yet', tone: 'neutral', detail: 'Set from the internet now; checked at the next power cut' };
  }
  return { label: rtc, tone: 'neutral', detail: `Battery clock: ${rtc}` };
}

/**
 * Where the board's time comes from now (firmware 2.1.1+). "server": internet time (NTP) is
 * blocked on its network, so the server sets its clock instead — correct, nothing to fix.
 */
export function timeSource(beat: BoardBeat | null | undefined): StatusCell {
  const c = beat?.clock;
  if (!c) return NONE;
  if (c === 'ntp') return { label: 'Internet', tone: 'good', detail: 'Set by an internet time server (NTP)' };
  if (c === 'server') {
    return { label: 'From server', tone: 'good', detail: 'Internet time (NTP) is blocked on its network: the server sets its clock, to within about a second' };
  }
  if (c === 'estimated') {
    return { label: 'Estimated', tone: 'warn', detail: 'Running on the time it had at power-up, until internet time or the server confirms it (seconds when online)' };
  }
  if (c === 'none') return { label: 'No time', tone: 'bad', detail: 'No time yet: it records nothing until internet time or the server answers' };
  return { label: c, tone: 'neutral', detail: `Clock: ${c}` };
}

/** Bytes as "512 B", "12.4 KB", "1.2 MB", "37.3 GB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Where the queue is and how much it holds (firmware 2.3+); empty for older firmware. */
function queuePlace(beat: BoardBeat): string {
  const room = beat.q_cap ? ` (room for ${formatBytes(beat.q_cap)})` : '';
  if (beat.qloc === 'ext') return `On the 16 MB flash chip${room}.`;
  if (beat.qloc === 'int') return `On the board's own flash${room}.`;
  if (beat.qloc === 'none') return 'No flash for it: what it measures only goes out live.';
  return '';
}

/**
 * Data the board holds that the server has not confirmed yet (normally empty within seconds).
 * A quarter of its room or more waiting is worth a look; anything ever dropped from a full
 * queue (a long outage) is said too.
 */
export function queue(beat: BoardBeat | null | undefined): StatusCell {
  const q = beat?.q_bytes;
  if (!beat || q === undefined || q === null || !Number.isFinite(q)) return NONE;
  const dropped = beat.q_dropped && beat.q_dropped > 0 ? beat.q_dropped : 0;
  const lost = dropped ? ` ${formatBytes(dropped)} dropped since it was set up: a long outage filled it (oldest first).` : '';
  const where = queuePlace(beat);
  const tail = `${where ? ` ${where}` : ''}${lost}`;
  if (q === 0) {
    return { label: 'Empty', tone: dropped ? 'warn' : 'good', detail: `Everything it measured has reached the server.${tail}` };
  }
  const big = beat.q_cap ? q > beat.q_cap / 4 : q > 64 * 1024;
  return {
    label: `${formatBytes(q)} waiting`,
    tone: big || dropped ? 'warn' : 'neutral',
    detail: `Saved on the board, not yet confirmed by the server.${tail}`,
  };
}

/** The 24 V supply the board measures (REV B). Under 20 V: low, or bench power without 24 V. */
export function supply(beat: BoardBeat | null | undefined): StatusCell {
  const v = beat?.vin_v;
  if (v === undefined || v === null || !Number.isFinite(v)) return NONE;
  const label = `${v.toFixed(1)} V`;
  return v >= 20
    ? { label, tone: 'good', detail: '24 V supply' }
    : { label, tone: 'warn', detail: 'Below 20 V: low supply, or powered without 24 V (bench)' };
}

export function firmware(beat: BoardBeat | null | undefined): string {
  return beat?.fw ?? '—';
}

/** Its onboarding date and time, in the viewer's clock: "28 Oct 2026, 22:55". */
export function onboarded(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : format(at, 'd MMM yyyy, HH:mm');
}
