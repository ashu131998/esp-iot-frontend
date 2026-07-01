import { SingleStatChartTableSkeleton } from '@/components/ui/page-skeletons';

export default function EnergyLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <SingleStatChartTableSkeleton tableCols={6} />
    </div>
  );
}
