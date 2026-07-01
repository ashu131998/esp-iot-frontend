'use client';

import dynamic from 'next/dynamic';

import { ChartSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';

const StatusTimelineBody = dynamic(
  () => import('@/components/uptime/status-timeline-body').then((m) => m.StatusTimelineBody),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export function StatusTimelineDashboard({ factoryId }: { factoryId: string }) {
  return (
    <div className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <QuerySuspense fallback={<ChartSkeleton />}>
        <StatusTimelineBody factoryId={factoryId} />
      </QuerySuspense>
    </div>
  );
}
