'use client';

import dynamic from 'next/dynamic';

import { UptimeCards } from '@/components/uptime/uptime-cards';
import { ChartSkeleton, StatGridChartSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const UptimeChartSection = dynamic(
  () => import('@/components/uptime/uptime-chart-section').then((m) => m.UptimeChartSection),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export function UptimeDashboard({ factoryId }: { factoryId: string }) {
  return (
    <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <QuerySuspense fallback={<StatGridChartSkeleton count={3} />}>
        <UptimeCards factoryId={factoryId} />
        <UptimeChartSection factoryId={factoryId} />
      </QuerySuspense>
    </div>
  );
}
