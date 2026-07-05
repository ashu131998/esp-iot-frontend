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
