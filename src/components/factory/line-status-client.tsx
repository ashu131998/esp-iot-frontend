'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { ListEmpty, ListGroup, ListRow, NumberTile, NumberTiles, SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { noEnergy, noProduction } from '@/lib/display';
import { useFactoryRefsOptional, useShown } from '@/lib/factory-refs-context';
import { sortByMachineName } from '@/lib/machine-sort';
import {
  STATE_TONE,
  humanMinutes,
  machineState,
  periodPhrase,
  plural,
  runTone,
  wholePercent,
  type MachineState,
} from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import type { Machine } from '@/lib/types';
import { unitsMade } from '@/lib/overview-figures';
import { formatNumber, formatUnits } from '@/lib/utils';

const REFRESH_INTERVAL_MS = 60_000;

/** Order the groups appear in: problems first. */
const GROUPS: { state: MachineState; title: string }[] = [
  { state: 'stopped', title: 'Stopped now' },
  { state: 'no_signal', title: 'No signal' },
  { state: 'running', title: 'Running now' },
];

export function LineStatusClient({
  factoryId,
  lineId,
  machines,
  from,
  to,
  minDate,
}: {
  factoryId: string;
  lineId: string;
  machines: Machine[];
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
    queryKey: ['line-status', factoryId, lineId, from ?? null, to ?? null],
    queryFn: async ({ signal }) => {
      const now = new Date();
      const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [availability, energy, production, uptime24h] = await Promise.all([
        api.availability(factoryId, { ...range, line_id: lineId }, { signal }),
        energyOn ? api.energy(factoryId, { ...range, line_id: lineId }, { signal }) : noEnergy(factoryId),
        productionOn
          ? api.production(factoryId, { ...range, line_id: lineId }, { signal })
          : noProduction(factoryId),
        api.uptime(factoryId, { from: from24h, to: now.toISOString(), line_id: lineId }, { signal }),
      ]);
      return { availability, energy, production, uptime24h };
    },
    refetchInterval,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_INTERVAL_MS / 1000);

  const { availability, energy, production, uptime24h } = data;

  const rows = useMemo(() => {
    const avail = new Map(availability.machines.map((m) => [m.machine_id, m]));
    const prod = new Map(production.machines.map((m) => [m.machine_id, m]));
    const live = new Map(uptime24h.machines.map((m) => [m.machine_id, m]));
    return sortByMachineName(machines).map((machine) => {
      const a = avail.get(machine.machine_id);
      return {
        machine,
        avail: a,
        prod: prod.get(machine.machine_id),
        state: machineState(live.get(machine.machine_id)?.timeline.at(-1)?.status ?? a?.status),
      };
    });
  }, [machines, availability, production, uptime24h]);

  const stopped = rows.filter((r) => r.state === 'stopped').length;
  const noSignal = rows.filter((r) => r.state === 'no_signal').length;
  const running = rows.length - stopped - noSignal;

  const summary =
    rows.length === 0
      ? { tone: 'idle' as const, badge: undefined, title: 'No machines on this line yet' }
      : stopped > 0
        ? { tone: 'bad' as const, badge: stopped, title: `${plural(stopped, 'machine')} stopped` }
        : noSignal > 0
          ? { tone: 'warn' as const, badge: noSignal, title: `${plural(noSignal, 'machine')} not sending data` }
          : { tone: 'good' as const, badge: undefined, title: rows.length === 1 ? 'The machine is running' : `All ${plural(rows.length, 'machine')} running` };

  return (
    <div className="space-y-6">
      <SummaryCard
        tone={summary.tone}
        badge={summary.badge}
        title={summary.title}
        subtitle={
          rows.length === 0
            ? undefined
            : summary.tone === 'good'
              ? 'Nothing needs attention'
              : `${running} of ${rows.length} running right now`
        }
      />

      <NumberTiles>
        <NumberTile
          label="Running time"
          value={wholePercent(availability.avg_availability_percent)}
          hint={`of ${period}`}
          tone={runTone(availability.avg_availability_percent)}
        />
        {productionOn && (
          <NumberTile label="Made" value={formatUnits(production.total_units, production.unit_label)} hint={period} />
        )}
        {energyOn && (
          <NumberTile label="Power used" value={`${formatNumber(energy.total_energy_kwh)} kWh`} hint={period} />
        )}
      </NumberTiles>

      {rows.length === 0 ? (
        <ListGroup title="Machines">
          <ListEmpty>No machines on this line.</ListEmpty>
        </ListGroup>
      ) : (
        GROUPS.map(({ state, title }) => {
          const group = rows.filter((r) => r.state === state);
          if (group.length === 0) return null;
          return (
            <ListGroup key={state} title={title} count={group.length}>
              {group.map(({ machine, avail, prod }) => (
                <ListRow
                  key={machine.machine_id}
                  href={`/factories/${machine.factory_id}/machines/${machine.machine_id}`}
                  tone={STATE_TONE[state]}
                  title={machine.name}
                  detail={
                    state === 'no_signal' && !avail?.uptime_minutes
                      ? 'No signal from the sensor'
                      : [
                        `Ran ${humanMinutes(avail?.uptime_minutes ?? 0)}`,
                        avail?.downtime_minutes ? `stopped ${humanMinutes(avail.downtime_minutes)}` : null,
                        productionOn && unitsMade(prod) !== null ? `made ${formatUnits(unitsMade(prod), prod?.unit_label)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                  }
                  value={wholePercent(avail?.availability_percent)}
                  valueHint="running"
                />
              ))}
            </ListGroup>
          );
        })
      )}
    </div>
  );
}
