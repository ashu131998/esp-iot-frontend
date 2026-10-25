'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import {
  ListGroup,
  ListRow,
  NumberTile,
  NumberTiles,
  SummaryCard,
} from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction, offQuery } from '@/lib/display';
import { useFactoryRefs, useShown } from '@/lib/factory-refs-context';
import {
  STATE_TONE,
  STATE_WORD,
  humanMinutes,
  machineState,
  periodPhrase,
  plural,
  wholePercent,
  type MachineState,
} from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatNumber, formatUnits, sharedUnitLabel, sumUnits } from '@/lib/utils';

const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

/** Order the groups appear in: problems first. */
const GROUPS: { state: MachineState; title: string }[] = [
  { state: 'stopped', title: 'Stopped now' },
  { state: 'no_signal', title: 'No signal' },
  { state: 'running', title: 'Running now' },
];

export function FactoryOverviewSimple({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, machines, lines, shifts } = useFactoryRefs();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const scopedMachines = useMemo(
    () => filterMachinesByScope(machines, { machineId, lineId }),
    [machines, machineId, lineId],
  );
  const machineIdsKey = scopedMachines.map((m) => m.machine_id).join(',');
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const shown = useShown();
  const energyOn = shown('energy');
  const productionOn = shown('production');
  const performanceOn = productionOn && shown('performance');
  const period = periodPhrase(from, to);

  const [
    { data: availability, dataUpdatedAt },
    { data: energy },
    { data: production },
    { data: uptime },
  ] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      energyOn
        ? {
          queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
          queryFn: ({ signal }: { signal: AbortSignal }) => api.energy(factoryId, apiRange, { signal }),
          refetchInterval,
          staleTime: 0,
        }
        : offQuery('energy', noEnergy(factoryId)),
      productionOn
        ? {
          queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
          queryFn: ({ signal }: { signal: AbortSignal }) => api.production(factoryId, apiRange, { signal }),
          refetchInterval,
          staleTime: 0,
        }
        : offQuery('production', noProduction(factoryId)),
      {
        queryKey: ['uptime-24h-overview', factoryId, 'all', machineIdsKey, ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => {
          if (!machineIdsKey) return Promise.resolve({ machines: [] });
          const now = new Date();
          return api.uptime(
            factoryId,
            {
              from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
              to: now.toISOString(),
              machine_ids: machineIdsKey,
            },
            { signal },
          );
        },
        refetchInterval,
        staleTime: 0,
      },
    ],
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_SEC);

  const lineName = useMemo(() => new Map(lines.map((l) => [l.line_id, l.name])), [lines]);

  const rows = useMemo(() => {
    const avail = new Map(availability.machines.map((m) => [m.machine_id, m]));
    const prod = new Map(production.machines.map((m) => [m.machine_id, m]));
    const eng = new Map(energy.machines.map((m) => [m.machine_id, m]));
    const live = new Map(uptime.machines.map((m) => [m.machine_id, m]));
    return scopedMachines.map((machine) => {
      const a = avail.get(machine.machine_id);
      const u = live.get(machine.machine_id);
      return {
        machine,
        avail: a,
        prod: prod.get(machine.machine_id),
        eng: eng.get(machine.machine_id),
        state: machineState(u?.timeline.at(-1)?.status ?? a?.status),
      };
    });
  }, [scopedMachines, availability, production, energy, uptime]);

  const count = (s: MachineState) => rows.filter((r) => r.state === s).length;
  const stopped = count('stopped');
  const noSignal = count('no_signal');
  const running = count('running');
  const total = rows.length;

  // Numbers for the tiles, over the machines in scope.
  const windowHours = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 3_600_000;
  const scopedAvail = filterMachinesByScope(availability.machines, { machineId, lineId });
  const avgAvailability = scopedAvail.length
    ? scopedAvail.reduce((s, m) => s + (m.availability_percent ?? 0), 0) / scopedAvail.length
    : availability.avg_availability_percent;
  const scopedProduction = filterMachinesByScope(production.machines, { machineId, lineId });
  const units = sumUnits(scopedProduction);
  const targetUnits = scopedMachines.reduce((s, m) => s + (m.target_units_per_hour ?? 0) * windowHours, 0);
  const throughputPct = targetUnits > 0 ? Math.min(100, (units / targetUnits) * 100) : 0;
  const onTargetPct = ((avgAvailability ?? 0) / 100) * throughputPct;
  const kwh = filterMachinesByScope(energy.machines, { machineId, lineId }).reduce((s, m) => s + (m.energy_kwh ?? 0), 0);

  const summary =
    total === 0
      ? { tone: 'idle' as const, badge: undefined, title: 'No machines here yet' }
      : stopped > 0
        ? { tone: 'bad' as const, badge: stopped, title: `${plural(stopped, 'machine')} stopped` }
        : noSignal > 0
          ? { tone: 'warn' as const, badge: noSignal, title: `${plural(noSignal, 'machine')} not sending data` }
          : { tone: 'good' as const, badge: undefined, title: total === 1 ? 'The machine is running' : `All ${plural(total, 'machine')} running` };

  return (
    <div className="space-y-6">
      <SummaryCard
        tone={summary.tone}
        badge={summary.badge}
        title={summary.title}
        subtitle={
          total === 0
            ? undefined
            : summary.tone === 'good'
              ? 'Nothing needs attention'
              : `${running} of ${total} running right now`
        }
      />

      {shown('overview.cards') && (
        <NumberTiles>
          <NumberTile label="Running time" value={wholePercent(avgAvailability)} hint={`of ${period}`} />
          {productionOn && (
            <NumberTile label="Made" value={formatUnits(units, sharedUnitLabel(scopedProduction))} hint={period} />
          )}
          {energyOn && <NumberTile label="Power used" value={`${formatNumber(kwh)} kWh`} hint={period} />}
          {performanceOn && (
            <NumberTile
              label="On target"
              value={targetUnits > 0 ? wholePercent(onTargetPct) : '—'}
              hint={targetUnits > 0 ? '100% = hit the target' : 'No target set'}
            />
          )}
        </NumberTiles>
      )}

      {shown('overview.table') && (
        <>
          {GROUPS.map(({ state, title }) => {
            const group = rows.filter((r) => r.state === state);
            if (group.length === 0) return null;
            return (
              <ListGroup key={state} title={title} count={group.length}>
                {group.map(({ machine, avail, prod }) => (
                  <ListRow
                    key={machine.machine_id}
                    href={`/factories/${factoryId}/machines/${machine.machine_id}`}
                    tone={STATE_TONE[state]}
                    title={machine.name}
                    tag={lineName.get(machine.line_id) ?? machine.line_id}
                    detail={rowSentence(state, avail, productionOn ? prod : undefined)}
                    value={wholePercent(avail?.availability_percent)}
                    valueHint="running"
                  />
                ))}
              </ListGroup>
            );
          })}

          <div className="flex flex-wrap items-center justify-end gap-3 px-1 text-sm">
            <ExportCsvButton
              filename="factory-machines"
              headers={[
                'Machine',
                'Line',
                'Now',
                'Running time %',
                ...(energyOn ? ['Power used (kWh)'] : []),
                ...(productionOn ? ['Made'] : []),
              ]}
              rows={rows.map(({ machine, avail, eng, prod, state }) => [
                machine.name,
                lineName.get(machine.line_id) ?? machine.line_id,
                STATE_WORD[state],
                avail?.availability_percent,
                ...(energyOn ? [eng?.energy_kwh] : []),
                ...(productionOn ? [prod?.units_produced ?? 0] : []),
              ])}
            />
            <Link href={`/factories/${factoryId}/configuration`} className="text-primary hover:underline">
              Manage machines →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** One short line per machine: how long it ran / stood, and what it made. */
function rowSentence(
  state: MachineState,
  avail?: { uptime_minutes: number; downtime_minutes: number },
  prod?: { units_produced: number; unit_label?: string | null },
): string {
  if (state === 'no_signal' && !avail?.uptime_minutes) return 'No signal from the sensor';
  const parts = [`Ran ${humanMinutes(avail?.uptime_minutes ?? 0)}`];
  if (avail?.downtime_minutes) parts.push(`stopped ${humanMinutes(avail.downtime_minutes)}`);
  if (prod) parts.push(`made ${formatUnits(prod.units_produced ?? 0, prod.unit_label)}`);
  return parts.join(' · ');
}
