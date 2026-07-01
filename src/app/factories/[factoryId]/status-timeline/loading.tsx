import { ChartSkeleton } from '@/components/ui/page-skeletons';

export default function StatusTimelineLoading() {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <ChartSkeleton />
    </div>
  );
}
