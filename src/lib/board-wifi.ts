/**
 * A board's WiFi as on a phone (firmware 2.9.4): the networks it sees, the one it is on, Connect and Retry,
 * and the networks it keeps. One panel serves ops (our super admin, any board) and a factory's WiFi page
 * (everyone of the factory connects a board; its admins also add and forget networks). The server checks
 * every rule (query-api boards.js connectPlan / addPlan / forgetPlan); these shape what the panel shows.
 */
import type { ListStatus } from '@/lib/wifi';

/** A network the board keeps, by name: its own (this board only) or its factory's (every board there). */
export interface SavedNetwork {
  ssid: string;
  own: boolean;
  open: boolean;
}

/** A network in its last scan: the strongest access point of that name. */
export interface SeenNetwork {
  ssid: string;
  rssi: number;
  open: boolean;
}

/** The connect last asked for and how it went (from its heartbeats). */
export interface WifiAttempt {
  ssid: string;
  state: 'trying' | 'connected' | 'failed';
  /** Why it failed: the board's code (lib/board-wifi wifiProblem). */
  reason: number | null;
}

export interface BoardWifi {
  board_id: string;
  factory_id: string | null;
  /** The machines it measures, by name: how the factory's people know a board. */
  machines: string[];
  camera: boolean;
  /** Its factory's networks, by name. */
  factory_networks: { ssid: string }[];
  /** Every network it keeps, its own first. */
  saved: SavedNetwork[];
  /** The one it should use (a connect sets it); null: the strongest. */
  preferred: string | null;
  max: number;
  room: number;
  /** False: why, in `reason` (not claimed, no settings yet, a rescue box, no broker here). */
  editable: boolean;
  reason: string | null;
  /** What this person may do: connect (everyone of the factory), manage (its admins: add, forget). */
  can: { connect: boolean; manage: boolean };
  /** Whether it has the settings last sent (they carry its WiFi). */
  status: ListStatus;
  cfg_version: number;
  online: boolean;
  /** The network it is on (or was last on) and the signal. */
  ssid: string | null;
  rssi: number | null;
  /** Its firmware scans and connects when asked (2.9.4+). */
  scans: boolean;
  seen: SeenNetwork[];
  seen_at: string | null;
  scan_asked: number;
  scan_done: number;
  attempt: WifiAttempt | null;
}

/** Where the panel's requests go: a factory's WiFi page (its people), or ops (null: our super admin). */
export type WifiScope = { factoryId: string } | null;

export type BoardWifiAction = 'scan' | 'connect' | 'retry' | 'add' | 'forget';

export function boardWifiPath(scope: WifiScope, boardId: string): string {
  const board = encodeURIComponent(boardId);
  return scope
    ? `/v1/factories/${encodeURIComponent(scope.factoryId)}/boards/${board}/wifi`
    : `/v1/admin/boards/${board}/wifi`;
}

/** Signal bars as a phone draws them: 4 strong … 1 very weak; 0 none. */
export function bars(rssi: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  if (rssi === null || rssi === undefined || rssi >= 0) return 0;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

export interface NetworkRow {
  ssid: string;
  rssi: number | null;
  open: boolean;
  /** It is on this one now. */
  connected: boolean;
  saved: SavedNetwork | null;
}

/** The phone-style list: the one it is on first, then the others by signal; each network once. */
export function networkRows(w: Pick<BoardWifi, 'seen' | 'saved' | 'online' | 'ssid' | 'rssi'>): NetworkRow[] {
  const on = w.online ? w.ssid : null;
  const savedOf = (ssid: string) => w.saved.find((n) => n.ssid === ssid) ?? null;
  const rows: NetworkRow[] = [];
  for (const n of w.seen) {
    if (rows.some((r) => r.ssid === n.ssid)) continue;
    rows.push({ ssid: n.ssid, rssi: n.rssi, open: n.open, connected: n.ssid === on, saved: savedOf(n.ssid) });
  }
  if (on && !rows.some((r) => r.ssid === on)) {   // on it, but not in the last scan (an older list)
    const saved = savedOf(on);
    rows.push({ ssid: on, rssi: w.rssi, open: saved?.open ?? false, connected: true, saved });
  }
  return rows.sort((a, b) => Number(b.connected) - Number(a.connected) || (b.rssi ?? -999) - (a.rssi ?? -999));
}

/** What a tap on a network asks for: nothing (it is on it), Connect at once (saved, or open), or its password. */
export function connectNeeds(row: Pick<NetworkRow, 'connected' | 'saved' | 'open'>): 'none' | 'connect' | 'password' {
  if (row.connected) return 'none';
  if (row.saved || row.open) return 'connect';
  return 'password';
}

/** A password the board can use: 8–63 plain characters. */
export function passwordOk(pass: string): boolean {
  return pass.length >= 8 && pass.length <= 63 && /^[\x20-\x7e]+$/.test(pass);
}

/** Where its scan stands: its firmware cannot, under way, waiting for it to be back, or done. */
export function scanState(w: Pick<BoardWifi, 'scans' | 'scan_asked' | 'scan_done' | 'online'>): 'unsupported' | 'scanning' | 'waiting' | 'idle' {
  if (!w.scans) return 'unsupported';
  if (w.scan_asked > w.scan_done) return w.online ? 'scanning' : 'waiting';
  return 'idle';
}

/** Why a connect did not work (ESP-IDF reasons; 250: joined, but no server through it), translated where shown. */
export type WifiProblem = 'password' | 'not-found' | 'refused' | 'signal' | 'no-internet' | 'other';

export function wifiProblem(code: number | null | undefined): WifiProblem | null {
  if (code === null || code === undefined || code === 0) return null;
  if (code === 15 || code === 202 || code === 204) return 'password';
  if (code === 201) return 'not-found';
  if (code === 203 || code === 205) return 'refused';
  if (code === 200 || code === 4 || code === 34) return 'signal';
  if (code === 250) return 'no-internet';
  return 'other';
}

export interface AttemptView {
  /** trying: under way; waiting: it is off, it tries when back; failed: it went back to a working network. */
  state: 'trying' | 'waiting' | 'failed';
  ssid: string;
  problem: WifiProblem | null;
  /** A new password may fix it: a wrong one for a network of its own (or a new one); the factory's are fixed by its admins. */
  newPassword: boolean;
}

/** The connect asked for, while there is something to say about it (connected: the header says so). */
export function attemptView(w: Pick<BoardWifi, 'attempt' | 'online' | 'saved'>): AttemptView | null {
  const a = w.attempt;
  if (!a || a.state === 'connected') return null;
  if (a.state === 'trying') return { state: w.online ? 'trying' : 'waiting', ssid: a.ssid, problem: null, newPassword: false };
  const problem = wifiProblem(a.reason) ?? 'other';
  const saved = w.saved.find((n) => n.ssid === a.ssid);
  return { state: 'failed', ssid: a.ssid, problem, newPassword: problem === 'password' && (!saved || saved.own) };
}

/** How often to look again: every 2 s while it is busy (a scan, a connect) and online; else every 10 s. */
export function pollMs(w: Pick<BoardWifi, 'online' | 'scans' | 'scan_asked' | 'scan_done' | 'attempt' | 'status'>): number {
  const busy = scanState(w) === 'scanning' || w.attempt?.state === 'trying' || w.status === 'waiting';
  return busy && w.online ? 2_000 : 10_000;
}

/** Whole minutes since `iso` (null: unknown). */
export function minutesAgo(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 60_000));
}

/** A board as its factory's people know it: by the machines it measures, else by its ID. */
export function boardName(b: { machines?: string[] | null; board_id: string }): string {
  return b.machines && b.machines.length > 0 ? b.machines.join(', ') : b.board_id;
}
