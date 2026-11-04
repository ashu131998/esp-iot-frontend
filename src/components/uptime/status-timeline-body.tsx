'use client';

import Link from 'next/link';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { UptimeTimeSeriesChart, type SegmentDetail } from '@/components/charts/metric-chart';
import { MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { UPTIME_TIMELINE_HOURS } from '@/lib/date-range';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Translate } from '@/lib/i18n/translate';
import { filterMachinesByScope, useFactoryDateRange } from '@/lib/use-factory-date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { runningShare } from '@/lib/plain-words';
import { formatAlertVia, statusLabel } from '@/lib/utils';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import type { ActiveAssignment, ConfigSelection, DowntimeReport, UptimeSegment } from '@/lib/types';
import { useFactoryHref } from '@/lib/factory-links-context';

const STATUS_TIMELINE_REFRESH_MS = 30_000;
const UPTIME_DETAIL_HOURS = 2;
/** Same bar height for 24h overview and 2h detail strips. */
const STATUS_TIMELINE_CHART_HEIGHT = 36;

function buildSegmentDetails(
  segment: UptimeSegment,
  reports: DowntimeReport[],
  selection: ConfigSelection | undefined,
  t: Translate,
  locale: Locale,
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
      details.push({ label: t('Reason'), value: report.reason_label });
      if (report.reported_by_name) {
        details.push({
          label: t('Told by'),
          value: t('{name} via {via}', { name: report.reported_by_name, via: t(formatAlertVia(report.reported_via)) }),
        });
      }
    } else if (report) {
      details.push({ label: t('Reason'), value: t('Waiting for the worker to give a reason') });
    }
  } else if (selection && new Date(selection.effective_from).getTime() <= segTo) {
    details.push({ label: t('Setting'), value: selection.profile_name ?? selection.profile_id });
    if (selection.selected_by_name) {
      details.push({
        label: t('Chosen by'),
        value: t('{name} via {via} · {time}', {
          name: selection.selected_by_name,
          via: t(formatAlertVia(selection.selected_via)),
          time: formatDateTime(selection.effective_from, locale),
        }),
      });
    }
  }
  return details;
}

export function StatusTimelineBody({ factoryId }: { factoryId: string }) {
  const link = useFactoryHref();
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const { t, locale } = useT();
  const refetchInterval = useRefetchInterval(STATUS_TIMELINE_REFRESH_MS);

  const timelineWindowLabel = t('{n} hours', { n: UPTIME_TIMELINE_HOURS });
  const uptimeParams = { ...range, ...(machineId ? { machine_id: machineId } : {}), ...(lineId ? { line_id: lineId } : {}) };

  const { data, dataUpdatedAt } = useSuspenseQuery({
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

  useSetRefreshInfo(dataUpdatedAt, STATUS_TIMELINE_REFRESH_MS / 1000);

  const overviewFrom = data.timeline_from;
  const overviewTo = data.timeline_to;
  const detailFrom = data.detail_from ?? data.timeline_from;
  const detailTo = data.detail_to ?? data.timeline_to;

  const displayRows = expandUptimeMachines(
    filterMachinesByScope(data.machines, { machineId, lineId }),
  );

  const detailLabel = t('{n} hours', { n: UPTIME_DETAIL_HOURS });

  function machineSubtitle(operatorNames: string, liveSince: string | null | undefined, currentStatus: string) {
    const parts: string[] = [];
    if (operatorNames) parts.push(t('Worker: {names}', { names: operatorNames }));
    if (liveSince) parts.push(t('{status} since {time}', { status: t(statusLabel(currentStatus)), time: formatDateTime(liveSince, locale) }));
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t('What each machine did')}
          description={t('Last 24 hours, and the last {n} hours up close', { n: UPTIME_DETAIL_HOURS })}
        />
        {data.meta?.requires_filter && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {data.meta.message ?? t('Too many machines to show at once. Pick a line or a machine above.')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400" />
            {t('Running')}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
            {t('Stopped')}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-gray-300" />
            {t('No signal')}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-white" />
            {t('No data')}
          </span>
          <span className="flex items-center gap-2">
            <span className="relative inline-block h-3 w-3">
              <span className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-slate-900" />
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-white bg-red-600" />
            </span>
            {t('Power cut')}
          </span>
        </div>
      </Card>

      {displayRows.length === 0 && (
        <Card>
          <p className="py-8 text-center text-sm text-muted">{t('Nothing to show yet')}</p>
        </Card>
      )}

      {displayRows.map((m) => {
        const operators: ActiveAssignment[] = assignments[m.machine_id] ?? [];
        const machineReports = allReports.filter((r) => r.machine_id === m.machine_id);
        const selection = latestSelections.get(m.machine_id);
        const currentStatus = m.live_status ?? m.timeline.at(-1)?.status ?? 'idle';
        const liveSince = m.live_since;
        const detailTimeline = m.detail_timeline ?? m.timeline;
        const operatorNames = operators
          .map((op) => op.worker_name ?? op.worker_id)
          .filter(Boolean)
          .join(', ');

        return (
          <Card key={m.stream_key}>
            <CardHeader
              title={
                <Link
                  href={link(`/factories/${factoryId}/machines/${m.machine_id}`)}
                  className="hover:text-primary hover:underline"
                >
                  {m.machine_name}
                </Link>
              }
              description={machineSubtitle(operatorNames, liveSince, currentStatus)}
              action={
                <div className="flex flex-wrap items-center gap-3">
                  <MachineStatusBadge status={currentStatus} />
                  {runningShare(m.availability_percent, t) && (
                    <span className="text-sm font-medium tabular-nums">{runningShare(m.availability_percent, t)}</span>
                  )}
                </div>
              }
            />
            <p className="mb-1 text-xs font-medium text-muted">
              {t('Last 24 hours')}
            </p>
            <UptimeTimeSeriesChart
              segments={m.timeline}
              windowFrom={overviewFrom}
              windowTo={overviewTo}
              windowLabel={timelineWindowLabel}
              height={STATUS_TIMELINE_CHART_HEIGHT}
              segmentDetails={(segment) => buildSegmentDetails(segment, machineReports, selection, t, locale)}
              powerCuts={m.power_cuts}
            />
            <p className="mb-1 mt-4 text-xs font-medium text-muted">
              {t('Last {n} hours', { n: UPTIME_DETAIL_HOURS })}
            </p>
            <UptimeTimeSeriesChart
              segments={detailTimeline}
              windowFrom={detailFrom}
              windowTo={detailTo}
              windowLabel={detailLabel}
              height={STATUS_TIMELINE_CHART_HEIGHT}
              segmentDetails={(segment) => buildSegmentDetails(segment, machineReports, selection, t, locale)}
              powerCuts={m.power_cuts}
            />
          </Card>
        );
      })}
    </div>
  );
}
