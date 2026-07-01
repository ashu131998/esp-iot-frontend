'use client';

import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { UptimeTimeSeriesChart } from '@/components/charts/metric-chart';
import { UPTIME_REFRESH_MS } from '@/components/uptime/refresh-countdown';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatRangeLabel, UPTIME_TIMELINE_HOURS } from '@/lib/date-range';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatPercent } from '@/lib/utils';
import type { ActiveAssignment } from '@/lib/types';

export function StatusTimelineBody({ factoryId }: { factoryId: string }) {
  const { range, live, machineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(UPTIME_REFRESH_MS);

  const timelineWindowLabel = `${UPTIME_TIMELINE_HOURS}h window`;

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['uptime', factoryId, live ? 'live' : range.from, live ? 'live' : range.to],
    queryFn: ({ signal }) => api.uptime(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  // Non-blocking: operator overlays fetch in parallel and never suspend the chart
  const { data: assignmentsData } = useQuery({
    queryKey: ['activeAssignments', factoryId],
    queryFn: ({ signal }) => api.activeAssignments(factoryId, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const assignments = assignmentsData?.assignments ?? {};

  useSetRefreshInfo(dataUpdatedAt, UPTIME_REFRESH_MS / 1000);

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const timelineLabel = formatRangeLabel(data.timeline_from, data.timeline_to);

  return (
    <Card>
      <CardHeader
        title="Status Timeline"
        description={`Last ${UPTIME_TIMELINE_HOURS} hours · ${timelineLabel}${isFetching ? ' · updating…' : ''}`}
      />
      <div className="mb-4 flex items-center gap-6 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
          Up
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
          Down
        </span>
      </div>

      <div className="space-y-8">
        {displayMachines.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No uptime data available</p>
        )}
        {displayMachines.map((m) => {
          const operators: ActiveAssignment[] = assignments[m.machine_id] ?? [];
          return (
            <div key={m.machine_id}>
              <div className="mb-2 grid grid-cols-3 items-center">
                <p className="min-w-0 truncate text-sm font-medium">{m.machine_name}</p>
                <p
                  className="min-w-0 truncate text-center text-sm font-medium"
                  title={
                    operators.length > 0
                      ? `Operator: ${operators.map((op) => op.worker_name ?? op.worker_id).join(', ')}`
                      : undefined
                  }
                >
                  {operators.length > 0
                    ? `Operator: ${operators.map((op) => op.worker_name ?? op.worker_id).join(', ')}`
                    : ''}
                </p>
                <p className="min-w-0 truncate text-right text-sm font-medium">
                  {m.line_id} · {formatPercent(m.availability_percent)} up
                </p>
              </div>
              <UptimeTimeSeriesChart
                segments={m.timeline}
                windowFrom={data.timeline_from}
                windowTo={data.timeline_to}
                windowLabel={timelineWindowLabel}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
