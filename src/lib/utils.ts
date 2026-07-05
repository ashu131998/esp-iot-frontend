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

export { formatRangeLabel, rangeDurationLabel } from '@/lib/date-range';

export function statusColor(status: string): string {
  switch (status) {
    case 'computed':
    case 'on':
    case 'up':
      return 'text-emerald-600 bg-emerald-50';
    case 'down':
      return 'text-red-600 bg-red-50';
    case 'estimated':
    case 'estimated_from_latest':
      return 'text-amber-600 bg-amber-50';
    // Device/link down → loom state unknown. Grey, not red: this is a signal
    // gap, not a machine stoppage.
    case 'offline':
    case 'idle':
    case 'no_data':
      return 'text-gray-500 bg-gray-100';
    case 'no_sensor':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-red-600 bg-red-50';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'computed':
    case 'on':
    case 'up':
      return 'Running';
    case 'estimated':
    case 'estimated_from_latest':
      return 'Estimated';
    case 'down':
      return 'Stopped';
    case 'idle':
      return 'No signal';
    case 'offline':
    case 'no_data':
      return 'No signal';
    case 'off':
    case 'no_sensor':
      return 'No sensor';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function isLiveStatus(status: string): boolean {
  return status === 'computed' || status === 'on' || status === 'up';
}
