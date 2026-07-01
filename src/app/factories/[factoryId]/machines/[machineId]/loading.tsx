import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';

export default function MachineDetailLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-12 bg-muted rounded animate-pulse" />
      <StatGridSkeleton count={3} />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
