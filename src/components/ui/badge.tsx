'use client';

import { useT } from '@/lib/i18n/context';
import { cn, normalizeMachineStatus, statusColor, statusLabel } from '@/lib/utils';

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

function statusDotClass(status: string): string {
  switch (normalizeMachineStatus(status)) {
    case 'running':
      return 'bg-emerald-600';
    case 'stopped':
      return 'bg-red-600';
    case 'no_signal':
      return 'bg-gray-400';
  }
}

/** Running | Stopped | No signal — the only three statuses shown to factory owners. */
export function MachineStatusBadge({ status }: { status: string }) {
  const { t } = useT();
  return (
    <Badge className={statusColor(status)}>
      <span className={`mr-1.5 inline-flex h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`} />
      {t(statusLabel(status))}
    </Badge>
  );
}

/** @deprecated use MachineStatusBadge */
export const LiveStatusBadge = MachineStatusBadge;

export function StatCard({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-gray-100', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-muted">{label}</span>
        {icon && <span className="shrink-0 text-gray-300">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
