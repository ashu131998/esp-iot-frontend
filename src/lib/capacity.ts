/**
 * The server's capacity on the System health page (GET /v1/admin/health → capacity):
 * how full the disk is, how fast it fills, how long until it is full, and the machines
 * against what the server carries. See backend docs/CAPACITY.md.
 */
import { formatBytes, type StatusCell } from '@/lib/board-status';

export interface Capacity {
  disk: { total: number; used: number; free: number; used_pct: number };
  db_bytes: number | null;
  growth_bytes_per_day: number | null;
  days_until_full: number | null;
  machines: number;
  machine_limit: number;
  verdict: 'ok' | 'plan' | 'act';
}

export function capacityVerdict(c: Capacity): StatusCell {
  if (c.verdict === 'act') {
    return { label: 'Add a volume now', tone: 'bad', detail: 'Disk 85 %+ full, full within 30 days, or 85 % of the machines it carries: add a Hetzner volume (docs/CAPACITY.md)' };
  }
  if (c.verdict === 'plan') {
    return { label: 'Plan a volume', tone: 'warn', detail: 'Disk 70 %+ full, full within 90 days, or 60 % of the machines it carries: add a Hetzner volume within weeks (docs/CAPACITY.md)' };
  }
  return { label: 'OK', tone: 'good', detail: 'Room to grow' };
}

/** "+50.0 MB a day", "shrinking", or not known yet. */
export function growthLabel(c: Capacity): string {
  const g = c.growth_bytes_per_day;
  if (g === null) return 'Measuring (needs half a day of samples)';
  if (g <= 0) return 'Not growing';
  return `+${formatBytes(g)} a day`;
}

/** How long until only 10 % of the disk is free, at the current rate. */
export function fullInLabel(c: Capacity): string {
  const d = c.days_until_full;
  if (d === null) return c.growth_bytes_per_day === null ? 'Measuring' : 'Not filling';
  if (d > 730) return 'Over 2 years';
  if (d > 90) return `About ${Math.round(d / 30)} months`;
  return `${d} day${d === 1 ? '' : 's'}`;
}

export function machinesLabel(c: Capacity): string {
  return `${c.machines} of ~${c.machine_limit}`;
}
