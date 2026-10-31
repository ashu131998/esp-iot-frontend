/**
 * The WiFi page (factory app and ops): a factory's networks and where each of its boards stands.
 * Boards (firmware 2.4+) join the strongest of the networks in range. The server checks the same
 * rules on save (query-api normalizeWifiList); these give the same answers before it is asked.
 */
import type { Tone } from '@/lib/board-status';

export const MAX_NETWORKS = 8;

export interface WifiNetwork {
  ssid: string;
  pass: string;
}

export type ListStatus = 'current' | 'waiting' | 'update-firmware' | 'not-set-up';

export interface WifiBoard {
  board_id: string;
  line_id: string | null;
  online: boolean;
  last_beat_at: string | null;
  ssid: string | null;
  rssi: number | null;
  last_drop: number | null;
  firmware: string | null;
  list: ListStatus;
}

export interface WifiPage {
  factory_id: string;
  networks: WifiNetwork[];
  boards: WifiBoard[];
  /** False when this server cannot reach the boards (no broker access): nothing can be sent. */
  managed: boolean;
  sent?: string[];
  skipped?: string[];
}

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/** What is wrong with a network before it is saved, or null. */
export function networkProblem(n: WifiNetwork, others: WifiNetwork[] = []): string | null {
  const ssid = n.ssid.trim();
  const bytes = utf8Bytes(ssid);
  if (bytes < 1) return 'Enter the WiFi name';
  if (bytes > 32) return 'A WiFi name has at most 32 characters';
  if (n.pass !== '' && (n.pass.length < 8 || n.pass.length > 63)) return 'A WiFi password has 8–63 characters';
  if (n.pass !== '' && !/^[\x20-\x7e]+$/.test(n.pass)) return 'Use plain letters, digits and symbols in the password';
  if (others.some((o) => o.ssid.trim() === ssid)) return `${ssid} is already in the list`;
  return null;
}

export function listProblem(list: WifiNetwork[]): string | null {
  if (list.length > MAX_NETWORKS) return `At most ${MAX_NETWORKS} networks`;
  for (let i = 0; i < list.length; i++) {
    const p = networkProblem(list[i], list.slice(0, i));
    if (p) return p;
  }
  return null;
}

/** Signal strength in a word: boards below -80 dBm drop out now and then. */
export function signalWord(rssi: number): { word: string; tone: Tone } {
  if (rssi >= -60) return { word: 'Strong', tone: 'good' };
  if (rssi >= -70) return { word: 'Good', tone: 'good' };
  if (rssi >= -80) return { word: 'Weak', tone: 'warn' };
  return { word: 'Very weak', tone: 'bad' };
}

/** Signal strength in words, with its dBm; unknown (null, or 0: not connected) as a dash. */
export function signal(rssi: number | null): { label: string; tone: Tone } {
  if (rssi === null || rssi >= 0) return { label: '—', tone: 'neutral' };
  const { word, tone } = signalWord(rssi);
  return { label: `${word} (${rssi} dBm)`, tone };
}

/** Why a board last left its network (ESP-IDF disconnect reasons), in words; null when nothing to say. */
export function dropReason(code: number | null): string | null {
  if (code === null || code === 0) return null;
  if (code === 15 || code === 202 || code === 204) return 'Wrong WiFi password';
  if (code === 201) return 'Network not found';
  if (code === 203 || code === 205) return 'The router refused it';
  if (code === 200 || code === 4 || code === 34) return 'Signal lost';
  return `Disconnected (code ${code})`;
}

export function listStatus(list: ListStatus, online: boolean): { label: string; tone: Tone } {
  switch (list) {
    case 'current':
      return { label: 'Has the latest list', tone: 'good' };
    case 'waiting':
      return online
        ? { label: 'Receiving the list…', tone: 'warn' }
        : { label: 'Gets it when back online', tone: 'warn' };
    case 'update-firmware':
      return { label: 'Needs firmware 2.4', tone: 'bad' };
    default:
      return { label: 'Not set up yet', tone: 'neutral' };
  }
}

export interface Readiness {
  total: number;
  current: number;
  waiting: number;
  needsFirmware: number;
  notSetUp: number;
  /** Every set-up board has the latest list: the router can be changed. */
  ready: boolean;
}

/** Whether it is safe to change the router: every board that uses the list has the latest one. */
export function readiness(boards: WifiBoard[]): Readiness {
  const count = (s: ListStatus) => boards.filter((b) => b.list === s).length;
  const r = {
    total: boards.length,
    current: count('current'),
    waiting: count('waiting'),
    needsFirmware: count('update-firmware'),
    notSetUp: count('not-set-up'),
  };
  return { ...r, ready: r.current > 0 && r.waiting === 0 && r.needsFirmware === 0 };
}

/** How many boards are on each network now (online ones only). */
export function boardsOn(boards: WifiBoard[], ssid: string): number {
  return boards.filter((b) => b.online && b.ssid === ssid).length;
}

/** The list changed from what was saved (order counts: boards try the strongest anyway, but the page shows it). */
export function listChanged(saved: WifiNetwork[], draft: WifiNetwork[]): boolean {
  return saved.length !== draft.length || saved.some((n, i) => n.ssid !== draft[i].ssid || n.pass !== draft[i].pass);
}
