/**
 * A board's own WiFi networks (Boards page, super admin): sent on top of its factory's list, for a
 * board whose spot needs a network the others do not. The server checks the same rules on save
 * (query-api normalizeBoardWifi); these give the same answers before it is asked.
 */
import type { Tone } from '@/lib/board-status';
import { networkProblem, signal, type ListStatus, type WifiNetwork } from '@/lib/wifi';

export interface BoardWifi {
  board_id: string;
  factory_id: string | null;
  /** Its own networks, with their passwords. */
  networks: WifiNetwork[];
  /** Its factory's, by name only: shared by every board there, changed on the factory's WiFi page. */
  factory_networks: { ssid: string }[];
  /** The one it should use (firmware 2.9.2 moves to it when it is in range); null: the strongest. */
  preferred: string | null;
  /** The most a board keeps in all (its own and its factory's). */
  max: number;
  /** False: why, in `reason` (not claimed, no settings yet, a rescue box, no broker here). */
  editable: boolean;
  reason: string | null;
  /** Where it stands with the settings last sent (they carry the list). */
  status: ListStatus;
  cfg_version: number;
  online: boolean;
  /** The network it is on now (from its heartbeats), and the signal. */
  ssid: string | null;
  rssi: number | null;
}

/** How many networks it has in all: its own, and its factory's under other names. */
export function totalNetworks(own: WifiNetwork[], factory: { ssid: string }[]): number {
  const names = new Set(own.map((n) => n.ssid.trim()));
  return own.length + factory.filter((n) => !names.has(n.ssid)).length;
}

/** How many more of its own it can have. */
export function roomLeft(own: WifiNetwork[], factory: { ssid: string }[], max: number): number {
  return Math.max(0, max - totalNetworks(own, factory));
}

/** Each of its own networks' problem (null: fine), and the list's as a whole (too many). */
export function ownProblems(own: WifiNetwork[], factory: { ssid: string }[], max: number): { rows: (string | null)[]; list: string | null } {
  const rows = own.map((n, i) => networkProblem(n, own.slice(0, i)));
  const total = totalNetworks(own, factory);
  const list = total > max
    ? `At most ${max} networks in all: its factory has ${factory.length}, so at most ${Math.max(0, max - factory.length)} of its own`
    : null;
  return { rows, list };
}

/** Its own networks as typed, trimmed the way the server keeps them. */
export function cleanOwn(own: WifiNetwork[]): WifiNetwork[] {
  return own.map((n) => ({ ssid: n.ssid.trim(), pass: n.pass }));
}

/** Changed from what it has (order counts: the server keeps it). */
export function ownChanged(saved: WifiNetwork[], draft: WifiNetwork[]): boolean {
  const d = cleanOwn(draft);
  return saved.length !== d.length || saved.some((n, i) => n.ssid !== d[i].ssid || n.pass !== d[i].pass);
}

/** The networks it can be told to use: its own (as typed, named, once each), then its factory's. */
export function networkChoices(own: WifiNetwork[], factory: { ssid: string }[]): string[] {
  const out: string[] = [];
  for (const n of [...cleanOwn(own), ...factory]) if (n.ssid && !out.includes(n.ssid)) out.push(n.ssid);
  return out;
}

/** The choice as it stands: null once that network is gone from the list (removed in the form). */
export function chosen(preferred: string | null, own: WifiNetwork[], factory: { ssid: string }[]): string | null {
  return preferred !== null && networkChoices(own, factory).includes(preferred) ? preferred : null;
}

/** Anything to save: its own networks, or the one to use. */
export function wifiChanged(saved: Pick<BoardWifi, 'networks' | 'preferred'>, draft: WifiNetwork[], preferred: string | null): boolean {
  return ownChanged(saved.networks, draft) || saved.preferred !== preferred;
}

/** Does its firmware move to the network it is told to use (2.9.2 and later)? */
export function switchesNetworks(fw: string | null | undefined): boolean {
  return versionAtLeast(fw, [2, 9, 2]);
}

/** Whether it has what was last sent, in words. */
export function sentStatus(w: Pick<BoardWifi, 'status' | 'online'>): { label: string; detail: string; tone: Tone } {
  switch (w.status) {
    case 'current':
      return { label: 'Has its list', detail: 'It applied the last settings sent, with this WiFi list.', tone: 'good' };
    case 'waiting':
      return w.online
        ? { label: 'Receiving it…', detail: 'Sent: it applies it within seconds.', tone: 'warn' }
        : { label: 'Gets it when back online', detail: 'Kept for it on the server: it takes it as soon as it connects.', tone: 'warn' };
    case 'update-firmware':
      return { label: 'Needs firmware 2.5', detail: 'Its firmware ignores WiFi lists: update it on the Firmware page.', tone: 'bad' };
    default:
      return { label: 'Not set up yet', detail: 'It gets its WiFi list with its settings.', tone: 'neutral' };
  }
}

/**
 * Does its firmware keep measuring when it applies new settings that leave its sensors as they are
 * (2.9.1 and later)? Older ones restart the sensors with every settings message.
 */
export function keepsMeasuring(fw: string | null | undefined): boolean {
  return versionAtLeast(fw, [2, 9, 1]);
}

function versionAtLeast(fw: string | null | undefined, from: [number, number, number]): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(fw ?? '');
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) if (v[i] !== from[i]) return v[i] > from[i];
  return true;
}

/**
 * The network it is on now, and whether the list it will have still holds it. A network that is not
 * on it may be one built into its firmware: it stays on it now, and it is a fallback after.
 */
export function currentNetwork(
  w: Pick<BoardWifi, 'online' | 'ssid' | 'rssi' | 'factory_networks'>,
  own: WifiNetwork[],
): { label: string; onList: boolean | null; tone: Tone } {
  if (!w.online || !w.ssid) return { label: 'Not connected now', onList: null, tone: 'neutral' };
  const s = signal(w.rssi);
  const onList = own.some((n) => n.ssid.trim() === w.ssid) || w.factory_networks.some((n) => n.ssid === w.ssid);
  return { label: `On ${w.ssid}${s.label === '—' ? '' : ` · ${s.label}`}`, onList, tone: s.tone };
}
