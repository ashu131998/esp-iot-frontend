import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return n.toFixed(decimals);
}

/**
 * Units produced with the machine's unit name: "25.4 m", "1200". Whole counts stay whole, others
 * keep up to 2 decimals. A 'mixed' label (machines counting in different units) is spelled out.
 */
export function formatUnits(value: number | null | undefined, label?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const n = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (label === 'mixed') return `${n} (mixed units)`;
  return label ? `${n} ${label}` : n;
}

/** The unit name the producing machines share: null when none, 'mixed' when they differ. */
export function sharedUnitLabel(machines: Array<{ unit_label?: string | null; status?: string }>): string | null {
  const labels = new Set(machines.filter((m) => m.status !== 'no_sensor').map((m) => m.unit_label ?? null));
  if (labels.size === 0) return null;
  return labels.size === 1 ? [...labels][0] : 'mixed';
}

/** Sum of units, to 2 decimals (units are fractional once rotations_per_unit is not 1). */
export function sumUnits(machines: Array<{ units_produced: number }>): number {
  return Math.round(machines.reduce((s, m) => s + (m.units_produced ?? 0), 0) * 100) / 100;
}

/**
 * A figure as a number, or null when it is unknown (null, missing, empty, not a number).
 * Charts draw null as no bar / no point: unknown must never be shown as 0.
 */
export function knownNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Average of the known figures, to one decimal; unknown ones (null) are left out rather
 * than counted as 0 %. Null when none is known. The same rule as the API's averages.
 */
export function averageKnown(values: Array<number | null | undefined>): number | null {
  const known = values.map(knownNumber).filter((v): v is number => v !== null);
  return known.length > 0 ? Math.round((known.reduce((s, v) => s + v, 0) / known.length) * 10) / 10 : null;
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human label for how a downtime reason or config was reported (legacy values included). */
export function formatAlertVia(via: string | null | undefined): string {
  if (!via || via === 'whatsapp' || via === 'mobile' || via === 'app') return 'mobile app';
  if (via === 'dashboard') return 'dashboard';
  return via;
}

export { formatRangeLabel, rangeDurationLabel } from '@/lib/date-range';

/** Owner-facing machine state — only these three labels appear in the UI. */
export type MachineDisplayStatus = 'running' | 'stopped' | 'no_signal';

/** Map API/internal status codes to Running | Stopped | No signal. */
export function normalizeMachineStatus(status: string): MachineDisplayStatus {
  switch (status) {
    case 'up':
    case 'on':
    case 'computed':
    case 'estimated':
    case 'estimated_from_latest':
      return 'running';
    case 'down':
    case 'off':
      return 'stopped';
    default:
      return 'no_signal';
  }
}

export function statusColor(status: string): string {
  switch (normalizeMachineStatus(status)) {
    case 'running':
      return status === 'estimated' || status === 'estimated_from_latest'
        ? 'text-amber-600 bg-amber-50'
        : 'text-emerald-600 bg-emerald-50';
    case 'stopped':
      return 'text-red-600 bg-red-50';
    case 'no_signal':
      return 'text-gray-500 bg-gray-100';
  }
}

export function statusLabel(status: string): string {
  switch (normalizeMachineStatus(status)) {
    case 'running':
      return 'Running';
    case 'stopped':
      return 'Stopped';
    case 'no_signal':
      return 'No signal';
  }
}

/** @deprecated use normalizeMachineStatus(status) === 'running' */
export function isLiveStatus(status: string): boolean {
  return normalizeMachineStatus(status) === 'running';
}
