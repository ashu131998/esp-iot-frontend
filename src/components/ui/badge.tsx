import { cn, normalizeMachineStatus, statusColor, statusLabel } from '@/lib/utils';

import { Card } from './card';

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
  return (
    <Badge className={statusColor(status)}>
      <span className={`mr-1.5 inline-flex h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`} />
      {statusLabel(status)}
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
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}
