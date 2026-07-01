import { StatGridChartSkeleton } from '@/components/ui/page-skeletons';

export default function UptimeLoading() {
  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <StatGridChartSkeleton count={3} />
    </div>
  );
}
