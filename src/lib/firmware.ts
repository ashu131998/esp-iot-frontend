/**
 * Remote firmware updates on the staff pages (firmware 2.2+ boards): the releases uploaded
 * on the Firmware page, which ones a board can take, and how its update is going (from
 * its heartbeats and what the dashboard last offered it).
 */
import type { AdminBoard, StatusCell } from '@/lib/board-status';

export interface FirmwareRelease {
  target: string;
  version: string;
  size: number;
  sha256: string;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

/** What the signing tool writes next to the image (<version>-<target>.sig.json). */
export interface ReleaseSignature {
  target: string;
  version: string;
  size: number;
  sha256: string;
  signature: string;
}

export const TARGET_LABEL: Record<string, string> = { 'rev-b': 'REV B', 'rev-a2': 'REV A2' };

export function targetLabel(target: string): string {
  return TARGET_LABEL[target] ?? target;
}

/** Read a .sig.json; throws with a reason if it is not one. */
export function parseReleaseSignature(text: string): ReleaseSignature {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('The signature file is not JSON: choose the .sig.json the signing tool wrote');
  }
  if (j.format !== 'floorbeat-fw/1') throw new Error('Not a firmware signature file (format floorbeat-fw/1)');
  const { target, version, size, sha256, signature } = j;
  if (typeof target !== 'string' || typeof version !== 'string' || typeof size !== 'number'
      || typeof sha256 !== 'string' || typeof signature !== 'string') {
    throw new Error('The signature file is incomplete');
  }
  return { target, version, size, sha256, signature };
}

/** The hardware a board runs on: what it says (2.2+), else what its name says. */
export function boardTargetOf(b: Pick<AdminBoard, 'board_id' | 'beat'>): string | null {
  const hw = b.beat?.hw;
  if (hw === 'rev-b' || hw === 'rev-a2') return hw;
  return b.board_id.startsWith('revb-') ? 'rev-b' : null;
}

/** Does the firmware it runs install updates from the dashboard (2.2.0 and later)? */
export function installsRemoteUpdates(fw: string | undefined | null): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(fw ?? '');
  if (!m) return false;
  const [maj, min] = [Number(m[1]), Number(m[2])];
  return maj > 2 || (maj === 2 && min >= 2);
}

/** Releases a board can be offered: its hardware, not what it runs; newest upload first. */
export function versionsFor(releases: FirmwareRelease[], b: Pick<AdminBoard, 'board_id' | 'beat'>): FirmwareRelease[] {
  const target = boardTargetOf(b);
  return releases
    .filter((r) => r.target === target && r.version !== b.beat?.fw)
    .sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at));
}

/** How its update is going: from its heartbeats first, else what was offered to it. */
export function updateStatus(b: Pick<AdminBoard, 'beat' | 'ota_version'>): StatusCell {
  const beat = b.beat ?? {};
  const v = beat.ota_version ?? b.ota_version ?? '';
  switch (beat.ota_state) {
    case 'downloading':
      return { label: `Downloading ${v}${beat.ota_pct !== undefined ? ` ${beat.ota_pct}%` : ''}`, tone: 'neutral', detail: 'Downloading over HTTPS; it restarts into it when done' };
    case 'available':
      return { label: `Starting ${v}`, tone: 'neutral', detail: 'Accepted (signature checked); it starts once it has been healthy for 2 minutes' };
    case 'installed':
      return { label: `Installed ${v}`, tone: 'neutral', detail: 'Restarting into it' };
    case 'failed':
      return { label: 'Update failed', tone: 'bad', detail: beat.ota_error ?? 'No reason given' };
    case 'rolled-back':
      return { label: 'Rolled back', tone: 'bad', detail: beat.ota_error ?? `${v} did not confirm itself healthy: back on the previous firmware` };
    default:
      break;
  }
  if (b.ota_version && beat.fw === b.ota_version) return { label: `Updated to ${b.ota_version}`, tone: 'good', detail: 'Runs the version offered to it' };
  if (b.ota_version) return { label: `Offered ${b.ota_version}`, tone: 'neutral', detail: 'Waiting for the board (it gets the offer when it is online)' };
  return { label: '—', tone: 'neutral', detail: 'No update offered from here' };
}

/** A file's bytes as base64 (the upload sends the image that way). */
export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
