/**
 * What the staff Nodes page shows about a board, from its latest heartbeat summary
 * (stored by the consumer; fields added over firmware versions, so any may be missing).
 */

export interface BoardBeat {
  fw?: string;
  uptime_s?: number;
  synced?: boolean;
  boot_count?: number;
  reset_reason?: string;
  q_bytes?: number;
  rtc?: string;
  rtc_status?: number;
  rtc_set?: boolean;
  vin_v?: number;
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

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

/** Bytes as "512 B", "12.4 KB", "1.2 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Data the board holds that the server has not confirmed yet (normally empty within seconds). */
export function queue(beat: BoardBeat | null | undefined): StatusCell {
  const q = beat?.q_bytes;
  if (q === undefined || q === null || !Number.isFinite(q)) return NONE;
  if (q === 0) return { label: 'Empty', tone: 'good', detail: 'Everything it measured has reached the server' };
  return {
    label: `${formatBytes(q)} waiting`,
    tone: q > 64 * 1024 ? 'warn' : 'neutral',
    detail: 'Saved on the board, not yet confirmed by the server',
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
