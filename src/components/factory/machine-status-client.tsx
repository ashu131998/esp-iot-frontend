'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Settings2, WifiOff } from 'lucide-react';

import { StatCard, MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { MachineAvailabilityTrends } from '@/components/factory/machine-availability-trends';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction } from '@/lib/display';
import { useFactoryRefsOptional, useShown } from '@/lib/factory-refs-context';
import { formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Translate, TranslatePlural } from '@/lib/i18n/translate';
import { unitsMade } from '@/lib/overview-figures';
import { humanMinutes } from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { formatAlertVia, formatNumber, formatPercent, formatUnits } from '@/lib/utils';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import type { UptimeSegment, UptimeStatus } from '@/lib/types';

const REFRESH_INTERVAL_MS = 60_000;
// Summary cards per row, by how many are shown (literal class names for Tailwind).
const GRID_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

function humanDuration(ms: number, t: Translate): string {
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? t('{h}h {m}m', { h, m: min % 60 }) : t('{m}m', { m: min });
}

/**
 * Plain-language summary of the last 24h: current state + how long, plus
 * stoppage count and total downtime, so the status is readable at a glance
 * without decoding the timeline strip.
 */
function statusNarrative(
  machineName: string,
  timeline: UptimeSegment[],
  t: Translate,
  tn: TranslatePlural,
  locale: Locale,
) {
  const last = timeline.at(-1);
  if (!last) return null;

  const state: UptimeStatus = last.status;
  const isRunning = state === 'up';
  const isNoSignal = state === 'idle' || state === 'offline';
  const sinceMs = Date.now() - new Date(last.from).getTime();
  const downSegments = timeline.filter((s) => s.status === 'down');
  const totalDownSec = downSegments.reduce((acc, s) => acc + s.duration_seconds, 0);

  const vars = { machine: machineName, duration: humanDuration(sinceMs, t), time: formatTime(last.from, locale) };
  const headline = isRunning
    ? t('{machine} is running — for {duration} (since {time}).', vars)
    : isNoSignal
      ? t('{machine} — no signal for {duration} (since {time}).', vars)
      : t('{machine} is stopped — for {duration} (since {time}).', vars);

  const history =
    downSegments.length === 0
      ? t('No stoppages in the last 24 hours.')
      : tn(
        downSegments.length,
        '{count} stoppage in the last 24 hours, totalling {duration} of downtime.',
        '{count} stoppages in the last 24 hours, totalling {duration} of downtime.',
        { duration: humanDuration(totalDownSec * 1000, t) },
      );

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
  const refs = useFactoryRefsOptional();
  const shifts = refs?.shifts;
  const maxDate = refs?.maxDate ?? null;
  const { t, tn, locale } = useT();
  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate, shifts, maxDate),
    [from, to, minDate, shifts, maxDate],
  );

  const refetchInterval = useRefetchInterval(REFRESH_INTERVAL_MS);
  // Energy / Production switched off for the factory: not requested, not shown.
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['machine-status', factoryId, machineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, machine_id: machineId }, { signal }),
        energyOn ? api.energy(factoryId, { ...range, machine_id: machineId }, { signal }) : noEnergy(factoryId),
        productionOn
          ? api.production(factoryId, { ...range, machine_id: machineId }, { signal })
          : noProduction(factoryId),
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

  // The metrics endpoints return every machine in the factory (machine_id is not a server filter).
  const machineAvail = availability.machines.find((m) => m.machine_id === machineId);
  const machineEnergy = energy.machines.find((m) => m.machine_id === machineId);
  const machineProduction = production.machines.find((m) => m.machine_id === machineId);
  const uptimeRows = expandUptimeMachines(uptime24h.machines);
  const latestReport = reportsData?.reports?.[0];
  const openReport = latestReport && !latestReport.resolved_at ? latestReport : null;
  const currentConfig = selectionsData?.selections?.[0];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className={`grid gap-4 ${GRID_COLS[1 + Number(energyOn) + Number(productionOn)]}`}>
        {energyOn && (
          <StatCard
            label={t('Total Energy')}
            value={machineEnergy?.energy_kwh != null ? `${formatNumber(machineEnergy.energy_kwh, 1, locale)} kWh` : '—'}
            sub={machineEnergy?.avg_amps != null ? t('Avg: {amps}A', { amps: formatNumber(machineEnergy.avg_amps, 1, locale) }) : t('No data')}
          />
        )}
        <StatCard
          label={t('Availability')}
          value={formatPercent(machineAvail?.availability_percent ?? null, locale)}
          sub={t('{up} up · {down} down', {
            up: humanMinutes(machineAvail?.uptime_minutes ?? 0, t),
            down: humanMinutes(machineAvail?.downtime_minutes ?? 0, t),
          })}
        />
        {productionOn && (
          <StatCard
            label={t('Units Produced')}
            value={formatUnits(unitsMade(machineProduction), machineProduction?.unit_label, locale, t('(mixed units)'))}
            sub={t('From proximity sensor detections')}
          />
        )}
      </div>

      {uptimeRows.length > 1 && (
        <p className="text-sm text-muted">
          {t('This machine has {count} sensor streams — each timeline is shown below.', { count: uptimeRows.length })}
        </p>
      )}

      {uptimeRows.map((stream) => {
        const streamNarrative = statusNarrative(stream.display_name, stream.timeline ?? [], t, tn, locale);
        const streamStatus = stream.timeline.at(-1)?.status ?? 'no_data';
        return (
          <Card key={stream.stream_key}>
            <CardHeader
              title={stream.display_name}
              description={`${t('Current status · last 24h')}${isFetching ? ` · ${t('updating…')}` : ''}`}
            />
            <div className="px-6 py-4">
              {streamNarrative && (
                <div
                  className={`mb-4 flex gap-3 rounded-lg border-l-4 p-4 ${
                    streamNarrative.isRunning
                      ? 'border-l-emerald-500 bg-emerald-50/60'
                      : streamNarrative.state === 'idle' || streamNarrative.state === 'offline'
                        ? 'border-l-gray-400 bg-gray-50'
                        : 'border-l-red-500 bg-red-50/60'
                  }`}
                >
                  {streamNarrative.isRunning ? (
                    <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : streamNarrative.state === 'idle' || streamNarrative.state === 'offline' ? (
                    <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                  ) : (
                    <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div className="text-sm">
                    <p className="font-semibold">{streamNarrative.headline}</p>
                    {streamNarrative.state === 'down' && openReport && (
                      <p className="mt-1 text-muted">
                        {openReport.reason_label
                          ? t('Reported reason: {reason}', { reason: openReport.reason_label }) +
                            (openReport.reported_by_name
                              ? ` (${t('{name} via {via}', { name: openReport.reported_by_name, via: t(formatAlertVia(openReport.reported_via)) })})`
                              : '')
                          : t('The assigned worker has been asked for the reason on the mobile app — no reply yet.')}
                      </p>
                    )}
                    {streamNarrative.isRunning && latestReport?.resolved_at && latestReport.reason_label && (
                      <p className="mt-1 text-muted">
                        {t('Last stoppage: {reason}{by}, resolved at {time}.', {
                          reason: latestReport.reason_label,
                          by: latestReport.reported_by_name ? ` (${t('reported by {name}', { name: latestReport.reported_by_name })})` : '',
                          time: formatTime(latestReport.resolved_at, locale),
                        })}
                      </p>
                    )}
                    <p className="mt-1 text-muted">{streamNarrative.history}</p>
                    {currentConfig && (
                      <p className="mt-1 flex items-center gap-1.5 text-muted">
                        <Settings2 className="h-3.5 w-3.5" />
                        {t('Running configuration:')}{' '}
                        <span className="font-medium text-foreground">
                          {currentConfig.profile_name ?? currentConfig.profile_id}
                        </span>
                        {currentConfig.selected_by_name
                          ? ` ${t('— selected by {name} via {via}', { name: currentConfig.selected_by_name, via: t(formatAlertVia(currentConfig.selected_via)) })}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3">
                <span className="text-sm font-medium">{t('Status')}</span>
                <div className="flex justify-end">
                  <MachineStatusBadge status={streamStatus} />
                </div>
                <span className="text-sm font-medium">{t('Timeline (Last 24h)')}</span>
                <MiniTimeline segments={stream.timeline ?? []} />
              </div>
            </div>
          </Card>
        );
      })}

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
