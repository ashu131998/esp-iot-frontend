'use client';

import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { UptimeTimeSeriesChart, type SegmentDetail } from '@/components/charts/metric-chart';
import { UPTIME_REFRESH_MS } from '@/components/uptime/refresh-countdown';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatRangeLabel, UPTIME_TIMELINE_HOURS } from '@/lib/date-range';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatPercent } from '@/lib/utils';
import type { ActiveAssignment, ConfigSelection, DowntimeReport, UptimeSegment } from '@/lib/types';

function shortTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Extra tooltip rows for one timeline segment: the reported downtime reason
 * for down runs, and the active configuration (plus who selected it) for up
 * runs — both collected via the workers' WhatsApp replies.
 */
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
          value: `${report.reported_by_name} via ${report.reported_via ?? 'WhatsApp'}`,
        });
      }
    } else if (report) {
      details.push({ label: 'Reason', value: 'Awaiting worker reply on WhatsApp' });
    }
  } else if (selection && new Date(selection.effective_from).getTime() <= segTo) {
    details.push({ label: 'Configuration', value: selection.profile_name ?? selection.profile_id });
    if (selection.selected_by_name) {
      details.push({
        label: 'Selected by',
        value: `${selection.selected_by_name} via ${selection.selected_via} · ${shortTime(selection.effective_from)}`,
      });
    }
  }
  return details;
}

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

  // Non-blocking overlays: operators, downtime reasons and config selections
  // fetch in parallel and never suspend the chart.
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
          const machineReports = allReports.filter((r) => r.machine_id === m.machine_id);
          const selection = latestSelections.get(m.machine_id);
          const operatorLabel = operators.length > 0
            ? `Operator: ${operators.map((op) => op.worker_name ?? op.worker_id).join(', ')}`
            : '';
          const configLabel = selection
            ? `Config: ${selection.profile_name ?? selection.profile_id}`
            : '';
          const configTitle = selection
            ? `${selection.profile_name ?? selection.profile_id}${
                selection.selected_by_name
                  ? ` — selected by ${selection.selected_by_name} via ${selection.selected_via} at ${shortTime(selection.effective_from)}`
                  : ''
              }`
            : undefined;
          return (
            <div key={m.machine_id}>
              <div className="mb-2 grid grid-cols-3 items-center">
                <p className="min-w-0 truncate text-sm font-medium">{m.machine_name}</p>
                <p
                  className="min-w-0 truncate text-center text-sm font-medium"
                  title={[operatorLabel, configTitle].filter(Boolean).join(' · ') || undefined}
                >
                  {operatorLabel}
                  {operatorLabel && configLabel ? ' · ' : ''}
                  {configLabel && (
                    <span className="text-muted">{configLabel}</span>
                  )}
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
