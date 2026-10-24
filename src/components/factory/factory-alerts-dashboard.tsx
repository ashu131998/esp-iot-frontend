'use client';

import { Suspense, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { LineMachineAlertFilters } from '@/components/alerts/alert-scope-filters';
import { api } from '@/lib/api';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { machineInAlertScope } from '@/lib/alert-machine-scope';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { cn } from '@/lib/utils';
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
  machineId: string;
  machineName: string;
  lineId: string;
  availability: number | null;
  uptimeMinutes: number;
  downtimeMinutes: number;
}

/** 289 → "4 h 49 m", 45 → "45 m". */
function humanMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} m`;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** One plain sentence an operator can read at a glance. */
function describe(alert: AlertItem): string {
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

      <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        {alerts.length === 0 ? (
          <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-500" />
        ) : (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white',
              critical.length > 0 ? 'bg-red-500' : 'bg-amber-500',
            )}
          >
            {alerts.length}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">
            {alerts.length === 0
              ? 'All machines are running well'
              : `${alerts.length} machine${alerts.length === 1 ? '' : 's'} need${alerts.length === 1 ? 's' : ''} attention`}
          </p>
          <p className="text-sm text-muted">
            {totalMachines} machine{totalMachines === 1 ? '' : 's'} checked · last 24 hours
          </p>
        </div>
      </div>

      {critical.length > 0 && (
        <AlertGroup
          title="Needs attention"
          hint={`Running less than ${CRIT_THRESHOLD}% of the time`}
          dot="bg-red-500"
          alerts={critical}
          factoryId={factoryId}
          lineName={lineName}
        />
      )}
      {warning.length > 0 && (
        <AlertGroup
          title="Keep an eye on"
          hint={`Running less than ${WARN_THRESHOLD}% of the time`}
          dot="bg-amber-400"
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
  dot,
  alerts,
  factoryId,
  lineName,
}: {
  title: string;
  hint: string;
  dot: string;
  alerts: AlertItem[];
  factoryId: string;
  lineName: Map<string, string>;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          {title} <span className="font-normal text-muted">· {alerts.length}</span>
        </h3>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        {alerts.map((alert) => (
          <Link
            key={alert.id}
            href={`/factories/${factoryId}/machines/${alert.machineId}`}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot)} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {alert.machineName}
                <span className="ml-2 text-sm font-normal text-muted">
                  {lineName.get(alert.lineId) ?? alert.lineId}
                </span>
              </p>
              <p className="truncate text-sm text-muted">{describe(alert)}</p>
            </div>
            {alert.availability !== null && (
              <span className="shrink-0 text-right">
                <span className="block text-base font-semibold tabular-nums text-foreground">
                  {Math.round(alert.availability)}%
                </span>
                <span className="block text-[11px] text-muted">running</span>
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </section>
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
