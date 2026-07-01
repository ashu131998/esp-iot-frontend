import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PageHeaderSkeleton() {
  return (
    <div className="border-b bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <Skeleton className="h-7 w-48 sm:h-8 sm:w-64" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-20" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        count === 3 && 'sm:grid-cols-3',
        count === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        count !== 3 && count !== 4 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={col}
                className={cn('h-4', col === 0 ? 'w-28' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-6 h-64 w-full rounded-lg" />
    </div>
  );
}

export function PageContentSkeleton({
  statCards = 4,
  withChart = false,
  withTable = true,
  tableRows = 5,
  className,
}: {
  statCards?: number;
  withChart?: boolean;
  withTable?: boolean;
  tableRows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6 p-4 sm:p-6 lg:p-8', className)}>
      {statCards > 0 && <StatGridSkeleton count={statCards} />}
      {withChart && <ChartSkeleton />}
      {withTable && <TableSkeleton rows={tableRows} />}
    </div>
  );
}

export function PlatformPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <PageContentSkeleton statCards={4} withTable />
    </>
  );
}

export function FactoryPageSkeleton({
  statCards = 4,
  withChart = false,
  className,
}: {
  statCards?: number;
  withChart?: boolean;
  className?: string;
}) {
  return (
    <PageContentSkeleton
      statCards={statCards}
      withChart={withChart}
      withTable
      className={className}
    />
  );
}
