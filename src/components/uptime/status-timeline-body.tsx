'use client';

import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { UptimeTimeSeriesChart, type SegmentDetail } from '@/components/charts/metric-chart';
import { UPTIME_REFRESH_MS } from '@/components/uptime/refresh-countdown';
import { MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatRangeLabel, UPTIME_TIMELINE_HOURS } from '@/lib/date-range';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatAlertVia, formatPercent } from '@/lib/utils';
import type { ActiveAssignment, ConfigSelection, DowntimeReport, UptimeSegment } from '@/lib/types';

function shortTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSegmentDetails(
  segment: UptimeSegment,
  reports: DowntimeReport[],
  selection: ConfigSelection | undefined,
): SegmentDetail[] {
  const details: SegmentDetail[] = [];
  const segFrom = new Date(segment.from).getTime();
  const segTo = new Date(segment.to).getTime();

  if (segment.status === 'down') {
    const report = reports.find((r) => {
      const since = new Date(r.down_since).getTime();
      const until = r.resolved_at ? new Date(r.resolved_at).getTime() : Number.POSITIVE_INFINITY;
      return since < segTo && until > segFrom;
    });
    if (report?.reason_label) {
      details.push({ label: 'Reason', value: report.reason_label });
      if (report.reported_by_name) {
        details.push({
          label: 'Reported by',
          value: `${report.reported_by_name} via ${formatAlertVia(report.reported_via)}`,
        });
      }
    } else if (report) {
      details.push({ label: 'Reason', value: 'Awaiting worker reply on mobile app' });
    }
  } else if (selection && new Date(selection.effective_from).getTime() <= segTo) {
    details.push({ label: 'Configuration', value: selection.profile_name ?? selection.profile_id });
    if (selection.selected_by_name) {
      details.push({
        label: 'Selected by',
        value: `${selection.selected_by_name} via ${formatAlertVia(selection.selected_via)} · ${shortTime(selection.effective_from)}`,
      });
    }
  }
  return details;
}

export function StatusTimelineBody({ factoryId }: { factoryId: string }) {
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(UPTIME_REFRESH_MS);

  const timelineWindowLabel = `${UPTIME_TIMELINE_HOURS}h window`;
  const uptimeParams = { ...range, ...(machineId ? { machine_id: machineId } : {}), ...(lineId ? { line_id: lineId } : {}) };

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['uptime', factoryId, live ? 'live' : range.from, live ? 'live' : range.to, lineId ?? '', machineId ?? ''],
    queryFn: ({ signal }) => api.uptime(factoryId, uptimeParams, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['activeAssignments', factoryId],
    queryFn: ({ signal }) => api.activeAssignments(factoryId, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const { data: reportsData } = useQuery({
    queryKey: ['downtime-reports', factoryId, 'timeline'],
    queryFn: ({ signal }) => api.downtimeReports(factoryId, { limit: 200 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const { data: selectionsData } = useQuery({
    queryKey: ['config-selections', factoryId, 'latest'],
    queryFn: ({ signal }) => api.configSelections(factoryId, { latest: 'true' }, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const assignments = assignmentsData?.assignments ?? {};
  const allReports = reportsData?.reports ?? [];
  const latestSelections = new Map(
    (selectionsData?.selections ?? []).map((s) => [s.machine_id, s]),
  );

  useSetRefreshInfo(dataUpdatedAt, UPTIME_REFRESH_MS / 1000);

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const timelineLabel = formatRangeLabel(data.timeline_from, data.timeline_to);

  return (
    <Card>
      <CardHeader
        title="Status Timeline"
        description={`Last ${UPTIME_TIMELINE_HOURS} hours · ${timelineLabel}${isFetching ? ' · updating…' : ''} · hover a segment for downtime reason & configuration`}
      />
      {data.meta?.requires_filter && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.meta.message ?? 'Too many machines — filter by line or machine to load timelines.'}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-6 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400" />
          Running
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
          Stopped
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-300" />
          No signal
        </span>
      </div>

      <div className="space-y-8">
        {displayMachines.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No timeline data available</p>
        )}
        {displayMachines.map((m) => {
          const operators: ActiveAssignment[] = assignments[m.machine_id] ?? [];
          const machineReports = allReports.filter((r) => r.machine_id === m.machine_id);
          const selection = latestSelections.get(m.machine_id);
          const currentStatus = m.timeline.at(-1)?.status ?? 'no_data';
          const operatorNames = operators
            .map((op) => op.worker_name ?? op.worker_id)
            .filter(Boolean)
            .join(', ');

          return (
            <div key={m.machine_id}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{m.machine_name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    Operator: {operatorNames || '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                  <MachineStatusBadge status={currentStatus} />
                  <span className="text-sm font-medium tabular-nums">
                    {formatPercent(m.availability_percent)} running
                  </span>
                </div>
              </div>
              <UptimeTimeSeriesChart
                segments={m.timeline}
                windowFrom={data.timeline_from}
                windowTo={data.timeline_to}
                windowLabel={timelineWindowLabel}
                segmentDetails={(segment) =>
                  buildSegmentDetails(segment, machineReports, selection)
                }
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
