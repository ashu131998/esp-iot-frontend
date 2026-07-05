'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Settings2, WifiOff } from 'lucide-react';

import { StatCard, MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { MachineAvailabilityTrends } from '@/components/factory/machine-availability-trends';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatAlertVia, formatNumber, formatPercent } from '@/lib/utils';
import type { UptimeSegment, UptimeStatus } from '@/lib/types';

const REFRESH_INTERVAL_MS = 60_000;

function humanDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Plain-language summary of the last 24h: current state + how long, plus
 * stoppage count and total downtime, so the status is readable at a glance
 * without decoding the timeline strip.
 */
function statusNarrative(machineName: string, timeline: UptimeSegment[]) {
  const last = timeline.at(-1);
  if (!last) return null;

  const state: UptimeStatus = last.status;
  const isRunning = state === 'up';
  const isNoSignal = state === 'idle' || state === 'offline' || state === 'no_data';
  const sinceMs = Date.now() - new Date(last.from).getTime();
  const downSegments = timeline.filter((s) => s.status === 'down');
  const totalDownSec = downSegments.reduce((acc, s) => acc + s.duration_seconds, 0);

  const headline = isRunning
    ? `${machineName} is running — for ${humanDuration(sinceMs)} (since ${timeLabel(last.from)}).`
    : isNoSignal
      ? `${machineName} — no signal for ${humanDuration(sinceMs)} (since ${timeLabel(last.from)}).`
      : `${machineName} is stopped — for ${humanDuration(sinceMs)} (since ${timeLabel(last.from)}).`;

  const history =
    downSegments.length === 0
      ? 'No stoppages in the last 24 hours.'
      : `${downSegments.length} stoppage${downSegments.length === 1 ? '' : 's'} in the last 24 hours, ` +
        `totalling ${humanDuration(totalDownSec * 1000)} of downtime.`;

  return { state, isRunning, headline, history };
}

export function MachineStatusClient({
  factoryId,
  machineId,
  from,
  to,
  minDate,
}: {
  factoryId: string;
  machineId: string;
  from?: string;
  to?: string;
  minDate?: string | null;
}) {
  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate),
    [from, to, minDate],
  );
  const rangeLabel = formatRangeLabel(range.from, range.to);

  const refetchInterval = useRefetchInterval(REFRESH_INTERVAL_MS);

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['machine-status', factoryId, machineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.energy(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.production(factoryId, { ...range, machine_id: machineId }, { signal }),
        api.uptime(factoryId, { from: from24h, to: now.toISOString(), machine_id: machineId }, { signal }),
      ]);
      return { availability, energy, production, uptime24h };
    },
    refetchInterval,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_INTERVAL_MS / 1000);

  // Non-blocking context: downtime reason + selected configuration (mobile app).
  const { data: reportsData } = useQuery({
    queryKey: ['downtime-reports', factoryId, machineId],
    queryFn: ({ signal }) =>
      api.downtimeReports(factoryId, { machine_id: machineId, limit: 5 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const { data: selectionsData } = useQuery({
    queryKey: ['config-selections', factoryId, machineId],
    queryFn: ({ signal }) =>
      api.configSelections(factoryId, { machine_id: machineId, limit: 1 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const { availability, energy, production, uptime24h } = data;

  const machineAvail = availability.machines[0];
  const machineEnergy = energy.machines[0];
  const machineProduction = production.machines[0];
  const machineUptime = uptime24h.machines[0];
  const status = machineUptime?.timeline.at(-1)?.status ?? 'no_data';

  const narrative = statusNarrative(
    machineUptime?.machine_name ?? machineId,
    machineUptime?.timeline ?? [],
  );
  const latestReport = reportsData?.reports?.[0];
  const openReport = latestReport && !latestReport.resolved_at ? latestReport : null;
  const currentConfig = selectionsData?.selections?.[0];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total Energy (${rangeLabel})`}
          value={`${formatNumber(machineEnergy?.energy_kwh ?? 0)} kWh`}
          sub={machineEnergy?.avg_amps != null ? `Avg: ${formatNumber(machineEnergy.avg_amps)}A` : 'No data'}
        />
        <StatCard
          label={`Availability (${rangeLabel})`}
          value={formatPercent(machineAvail?.availability_percent ?? null)}
          sub={`${formatNumber(machineAvail?.uptime_minutes ?? 0, 0)}m up · ${formatNumber(machineAvail?.downtime_minutes ?? 0, 0)}m down`}
        />
        <StatCard
          label={`Units Produced (${rangeLabel})`}
          value={String(machineProduction?.units_produced ?? 0)}
          sub="From proximity sensor detections"
        />
      </div>

      {/* Machine status card */}
      <Card>
        <CardHeader
          title="Current Status"
          description={`${rangeLabel} · timeline shows last 24h${isFetching ? ' · updating…' : ''}`}
        />
        <div className="px-6 py-4">
          {narrative && (
            <div
              className={`mb-4 flex gap-3 rounded-lg border-l-4 p-4 ${
                narrative.isRunning
                  ? 'border-l-emerald-500 bg-emerald-50/60'
                  : narrative.state === 'idle' || narrative.state === 'offline'
                    ? 'border-l-gray-400 bg-gray-50'
                    : 'border-l-red-500 bg-red-50/60'
              }`}
            >
              {narrative.isRunning ? (
                <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : narrative.state === 'idle' || narrative.state === 'offline' ? (
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
              ) : (
                <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div className="text-sm">
                <p className="font-semibold">{narrative.headline}</p>
                {narrative.state === 'down' && openReport && (
                  <p className="mt-1 text-muted">
                    {openReport.reason_label
                      ? `Reported reason: ${openReport.reason_label}` +
                        (openReport.reported_by_name
                          ? ` (${openReport.reported_by_name} via ${formatAlertVia(openReport.reported_via)})`
                          : '')
                      : 'The assigned worker has been asked for the reason on the mobile app — no reply yet.'}
                  </p>
                )}
                {narrative.isRunning && latestReport?.resolved_at && latestReport.reason_label && (
                  <p className="mt-1 text-muted">
                    Last stoppage: {latestReport.reason_label}
                    {latestReport.reported_by_name ? ` (reported by ${latestReport.reported_by_name})` : ''}
                    , resolved at {timeLabel(latestReport.resolved_at)}.
                  </p>
                )}
                <p className="mt-1 text-muted">{narrative.history}</p>
                {currentConfig && (
                  <p className="mt-1 flex items-center gap-1.5 text-muted">
                    <Settings2 className="h-3.5 w-3.5" />
                    Running configuration:{' '}
                    <span className="font-medium text-foreground">
                      {currentConfig.profile_name ?? currentConfig.profile_id}
                    </span>
                    {currentConfig.selected_by_name
                      ? ` — selected by ${currentConfig.selected_by_name} via ${currentConfig.selected_via}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3">
            <span className="text-sm font-medium">Status</span>
            <div className="flex justify-end"><MachineStatusBadge status={status} /></div>
            <span className="text-sm font-medium">Timeline (Last 24h)</span>
            <MiniTimeline segments={machineUptime?.timeline ?? []} />
          </div>
        </div>
      </Card>

      {/* Lazy-loaded availability trends */}
      <MachineAvailabilityTrends
        factoryId={factoryId}
        machineId={machineId}
        from={from}
        to={to}
      />
    </div>
  );
}
