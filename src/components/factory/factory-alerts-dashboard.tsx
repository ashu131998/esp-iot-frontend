'use client';

import { Suspense, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import { LineMachineAlertFilters } from '@/components/alerts/alert-scope-filters';
import { api } from '@/lib/api';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { ListGroup, ListRow, SummaryCard, type Tone } from '@/components/ui/simple';
import { machineInAlertScope } from '@/lib/alert-machine-scope';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { humanMinutes, plural, wholePercent } from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';

const WARN_THRESHOLD = 85;
const CRIT_THRESHOLD = 70;
const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

type AlertSeverity = 'critical' | 'warning';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  noSignal: boolean;
  /** No current sensor mapped to it at all: it cannot be watched, which is not a lost signal. */
  noSensor: boolean;
  machineId: string;
  machineName: string;
  lineId: string;
  availability: number | null;
  uptimeMinutes: number;
  downtimeMinutes: number;
}

/** One plain sentence an operator can read at a glance. */
function describe(alert: AlertItem): string {
  if (alert.noSensor) return 'No sensor fitted — it cannot be watched';
  if (alert.noSignal) return 'No signal from the sensor';
  if (alert.uptimeMinutes === 0) return `Not running · stopped ${humanMinutes(alert.downtimeMinutes)}`;
  return `Stopped ${humanMinutes(alert.downtimeMinutes)} · ran ${humanMinutes(alert.uptimeMinutes)}`;
}

function FactoryAlertsDashboardInner({ factoryId }: { factoryId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lineFilter = searchParams.get('line_id') ?? '';
  const machineFilter = searchParams.get('machine_id') ?? '';
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const lines = useFactoryRefsOptional()?.lines;
  const lineName = useMemo(
    () => new Map((lines ?? []).map((l) => [l.line_id, l.name])),
    [lines],
  );

  function setQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (patch.line_id !== undefined) next.delete('machine_id');
    router.replace(`/factories/${factoryId}/alerts?${next.toString()}`);
  }

  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['availability-factory-alerts', factoryId],
    queryFn: ({ signal }) => {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return api.availability(factoryId, { from, to }, { signal });
    },
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_SEC);

  const { alerts, totalMachines } = useMemo(() => {
    const result: AlertItem[] = [];
    let total = 0;

    for (const machine of data.machines) {
      if (!machineInAlertScope(machine, lineFilter, machineFilter)) continue;
      total += 1;

      const noSignal =
        machine.status === 'down' || machine.status === 'no_data' || machine.status === 'no_sensor';
      const pct = machine.availability_percent;
      let severity: AlertSeverity | null = null;
      if (noSignal || (pct !== null && pct < CRIT_THRESHOLD)) severity = 'critical';
      else if (pct !== null && pct < WARN_THRESHOLD) severity = 'warning';
      if (!severity) continue;

      result.push({
        id: machine.machine_id,
        severity,
        noSignal,
        noSensor: machine.status === 'no_sensor',
        machineId: machine.machine_id,
        machineName: machine.machine_name,
        lineId: machine.line_id,
        availability: pct,
        uptimeMinutes: machine.uptime_minutes,
        downtimeMinutes: machine.downtime_minutes,
      });
    }

    result.sort((a, b) => (a.availability ?? -1) - (b.availability ?? -1));
    return { alerts: result, totalMachines: total };
  }, [data, lineFilter, machineFilter]);

  const critical = alerts.filter((a) => a.severity === 'critical');
  const warning = alerts.filter((a) => a.severity === 'warning');

  return (
    <div className="space-y-6">
      <LineMachineAlertFilters
        factoryId={factoryId}
        lineFilter={lineFilter}
        machineFilter={machineFilter}
        onChange={setQuery}
      />

      <SummaryCard
        tone={alerts.length === 0 ? 'good' : critical.length > 0 ? 'bad' : 'warn'}
        badge={alerts.length === 0 ? undefined : alerts.length}
        title={
          alerts.length === 0
            ? 'All machines are running well'
            : `${plural(alerts.length, 'machine')} need${alerts.length === 1 ? 's' : ''} attention`
        }
        subtitle={`${plural(totalMachines, 'machine')} checked · last 24 hours`}
      />

      {critical.length > 0 && (
        <AlertGroup
          title="Needs attention"
          hint={`Running less than ${CRIT_THRESHOLD}% of the time`}
          tone="bad"
          alerts={critical}
          factoryId={factoryId}
          lineName={lineName}
        />
      )}
      {warning.length > 0 && (
        <AlertGroup
          title="Keep an eye on"
          hint={`Running less than ${WARN_THRESHOLD}% of the time`}
          tone="warn"
          alerts={warning}
          factoryId={factoryId}
          lineName={lineName}
        />
      )}
    </div>
  );
}

function AlertGroup({
  title,
  hint,
  tone,
  alerts,
  factoryId,
  lineName,
}: {
  title: string;
  hint: string;
  tone: Tone;
  alerts: AlertItem[];
  factoryId: string;
  lineName: Map<string, string>;
}) {
  return (
    <ListGroup title={title} count={alerts.length} hint={hint}>
      {alerts.map((alert) => (
        <ListRow
          key={alert.id}
          href={`/factories/${factoryId}/machines/${alert.machineId}`}
          tone={tone}
          title={alert.machineName}
          tag={lineName.get(alert.lineId) ?? alert.lineId}
          detail={describe(alert)}
          value={alert.availability !== null ? wholePercent(alert.availability) : undefined}
          valueHint={alert.availability !== null ? 'running' : undefined}
        />
      ))}
    </ListGroup>
  );
}

export function FactoryAlertsDashboard({ factoryId }: { factoryId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <StatGridSkeleton count={3} />
        </div>
      }
    >
      <FactoryAlertsDashboardInner factoryId={factoryId} />
    </Suspense>
  );
}
