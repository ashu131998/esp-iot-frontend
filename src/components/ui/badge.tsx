import { cn, statusColor, statusLabel, isLiveStatus } from '@/lib/utils';

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

export function LiveStatusBadge({ status }: { status: string }) {
  const live = isLiveStatus(status);
  return (
    <Badge className={statusColor(status)}>
      {live ? (
        <span className="mr-1.5 relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
      ) : (
        <span className="mr-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-current opacity-50" />
      )}
      {statusLabel(status)}
    </Badge>
  );
}

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
