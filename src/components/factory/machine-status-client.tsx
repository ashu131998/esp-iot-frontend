'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, WifiOff } from 'lucide-react';

import { MiniTimeline } from '@/components/ui/mini-timeline';
import { ListGroup, ListRow, NumberTile, NumberTiles, SummaryCard, TONE_DOT } from '@/components/ui/simple';
import { MachineAvailabilityTrends } from '@/components/factory/machine-availability-trends';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction } from '@/lib/display';
import { useFactoryRefsOptional, useShown } from '@/lib/factory-refs-context';
import {
  STATE_TONE,
  STATE_WORD,
  humanMinutes,
  machineState,
  periodPhrase,
  plural,
  runTone,
  wholePercent,
  type MachineState,
} from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { unitsMade } from '@/lib/overview-figures';
import { cn, formatAlertVia, formatNumber, formatUnits } from '@/lib/utils';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import type { UptimeSegment } from '@/lib/types';

const REFRESH_INTERVAL_MS = 60_000;

/** Worst first: a stopped sensor decides the headline over a running one. */
const STATE_RANK: Record<MachineState, number> = { stopped: 0, no_signal: 1, running: 2 };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** What one sensor stream is doing now, for how long, and how often it stopped in the last 24h. */
function streamStory(timeline: UptimeSegment[]) {
  const last = timeline.at(-1);
  if (!last) return null;
  const state = machineState(last.status);
  const forMin = (Date.now() - new Date(last.from).getTime()) / 60_000;
  const stops = timeline.filter((s) => s.status === 'down');
  const stoppedMin = stops.reduce((acc, s) => acc + s.duration_seconds, 0) / 60;
  return {
    state,
    headline: `${STATE_WORD[state]} for ${humanMinutes(Math.max(1, forMin))}`,
    since: `Since ${timeLabel(last.from)}`,
    history:
      stops.length === 0
        ? 'No stops in the last 24 hours'
        : `${plural(stops.length, 'stop')} in the last 24 hours · ${humanMinutes(stoppedMin)} in total`,
  };
}

const STATE_ICON: Record<MachineState, React.ReactNode> = {
  running: <ArrowUpCircle className="h-5 w-5" />,
  stopped: <ArrowDownCircle className="h-5 w-5" />,
  no_signal: <WifiOff className="h-5 w-5" />,
};

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
  const shifts = useFactoryRefsOptional()?.shifts;
  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate, shifts),
    [from, to, minDate, shifts],
  );

  const refetchInterval = useRefetchInterval(REFRESH_INTERVAL_MS);
  // Energy / Production switched off for the factory: not requested, not shown.
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');
  const period = periodPhrase(from, to);

  const { data, dataUpdatedAt } = useSuspenseQuery({
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

  const machineAvail = availability.machines.find((m) => m.machine_id === machineId);
  const machineEnergy = energy.machines.find((m) => m.machine_id === machineId);
  const machineProduction = production.machines.find((m) => m.machine_id === machineId);
  const streams = expandUptimeMachines(uptime24h.machines).map((s) => ({ ...s, story: streamStory(s.timeline ?? []) }));
  const lead = [...streams]
    .filter((s) => s.story)
    .sort((a, b) => STATE_RANK[a.story!.state] - STATE_RANK[b.story!.state])[0]?.story;
  const latestReport = reportsData?.reports?.[0];
  const openReport = latestReport && !latestReport.resolved_at ? latestReport : null;
  const currentConfig = selectionsData?.selections?.[0];

  const details: { title: string; detail: string }[] = [];
  if (lead?.state === 'stopped') {
    details.push({
      title: 'Why it stopped',
      detail: openReport?.reason_label
        ? `${openReport.reason_label}${openReport.reported_by_name ? ` · told by ${openReport.reported_by_name} (${formatAlertVia(openReport.reported_via)})` : ''}`
        : 'Waiting for the worker to give a reason on the app',
    });
  }
  if (lead?.state === 'running' && latestReport?.resolved_at && latestReport.reason_label) {
    details.push({
      title: 'Last stop',
      detail: `${latestReport.reason_label}${latestReport.reported_by_name ? ` · told by ${latestReport.reported_by_name}` : ''} · fixed at ${timeLabel(latestReport.resolved_at)}`,
    });
  }
  if (currentConfig) {
    details.push({
      title: 'Setting in use',
      detail: `${currentConfig.profile_name ?? currentConfig.profile_id}${currentConfig.selected_by_name ? ` · chosen by ${currentConfig.selected_by_name}` : ''}`,
    });
  }

  return (
    <div className="space-y-6">
      {lead ? (
        <SummaryCard
          tone={STATE_TONE[lead.state]}
          icon={STATE_ICON[lead.state]}
          title={lead.headline}
          subtitle={`${lead.since} · ${lead.history}`}
        />
      ) : (
        <SummaryCard tone="idle" icon={STATE_ICON.no_signal} title="No data from this machine yet" />
      )}

      {details.length > 0 && (
        <ListGroup title="Details">
          {details.map((d) => (
            <ListRow key={d.title} title={d.title} detail={d.detail} />
          ))}
        </ListGroup>
      )}

      <NumberTiles>
        <NumberTile
          label="Running time"
          value={wholePercent(machineAvail?.availability_percent)}
          hint={`ran ${humanMinutes(machineAvail?.uptime_minutes ?? 0)} · stopped ${humanMinutes(machineAvail?.downtime_minutes ?? 0)}`}
          tone={runTone(machineAvail?.availability_percent)}
        />
        {productionOn && (
          <NumberTile
            label="Made"
            value={formatUnits(unitsMade(machineProduction), machineProduction?.unit_label)}
            hint={period}
          />
        )}
        {energyOn && (
          <NumberTile
            label="Power used"
            value={machineEnergy?.energy_kwh != null ? `${formatNumber(machineEnergy.energy_kwh)} kWh` : '—'}
            hint={period}
          />
        )}
      </NumberTiles>

      {streams.length > 0 && (
        <ListGroup title="Last 24 hours" hint="Green = running · red = stopped · grey = no signal">
          {streams.map((s) => (
            <div key={s.stream_key} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[STATE_TONE[s.story?.state ?? 'no_signal']])}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {streams.length === 1 ? 'This machine' : s.display_name}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {s.story ? `${s.story.headline} · ${s.story.history}` : 'No data'}
                  </p>
                </div>
              </div>
              <MiniTimeline segments={s.timeline ?? []} />
            </div>
          ))}
        </ListGroup>
      )}

      <MachineAvailabilityTrends
        factoryId={factoryId}
        machineId={machineId}
        from={from}
        to={to}
      />
    </div>
  );
}
