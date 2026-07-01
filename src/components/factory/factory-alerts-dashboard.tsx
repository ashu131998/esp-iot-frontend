'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, StatCard } from '@/components/ui/badge';
import { formatPercent } from '@/lib/utils';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';

const WARN_THRESHOLD = 85;
const CRIT_THRESHOLD = 70;
const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

type AlertSeverity = 'critical' | 'warning';
type AlertType = 'offline' | 'low_availability';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  machineId: string;
  machineName: string;
  lineId: string;
  availability: number | null;
  uptimeMinutes: number;
  downtimeMinutes: number;
}

function severityConfig(severity: AlertSeverity) {
  if (severity === 'critical') {
    return {
      Icon: XCircle,
      badge: 'bg-red-50 text-red-700',
      borderClass: 'border-l-red-500',
      iconClass: 'text-red-500',
      label: 'Critical',
    };
  }
  return {
    Icon: AlertTriangle,
    badge: 'bg-amber-50 text-amber-700',
    borderClass: 'border-l-amber-400',
    iconClass: 'text-amber-500',
    label: 'Warning',
  };
}

export function FactoryAlertsDashboard({ factoryId }: { factoryId: string }) {
  const refetchInterval = useRefetchInterval(REFRESH_MS);

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

  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];

    for (const machine of data.machines) {
      const isOffline =
        machine.status === 'down' ||
        machine.status === 'no_data' ||
        machine.status === 'no_sensor';

      if (isOffline) {
        result.push({
          id: `${machine.machine_id}-offline`,
          severity: 'critical',
          type: 'offline',
          machineId: machine.machine_id,
          machineName: machine.machine_name,
          lineId: machine.line_id,
          availability: machine.availability_percent,
          uptimeMinutes: machine.uptime_minutes,
          downtimeMinutes: machine.downtime_minutes,
        });
      } else if (machine.availability_percent !== null) {
        if (machine.availability_percent < CRIT_THRESHOLD) {
          result.push({
            id: `${machine.machine_id}-crit`,
            severity: 'critical',
            type: 'low_availability',
            machineId: machine.machine_id,
            machineName: machine.machine_name,
            lineId: machine.line_id,
            availability: machine.availability_percent,
            uptimeMinutes: machine.uptime_minutes,
            downtimeMinutes: machine.downtime_minutes,
          });
        } else if (machine.availability_percent < WARN_THRESHOLD) {
          result.push({
            id: `${machine.machine_id}-warn`,
            severity: 'warning',
            type: 'low_availability',
            machineId: machine.machine_id,
            machineName: machine.machine_name,
            lineId: machine.line_id,
            availability: machine.availability_percent,
            uptimeMinutes: machine.uptime_minutes,
            downtimeMinutes: machine.downtime_minutes,
          });
        }
      }
    }

    return result.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      const aVal = a.availability ?? 0;
      const bVal = b.availability ?? 0;
      return aVal - bVal;
    });
  }, [data]);

  const totalMachines = data.machines.length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const lastUpdated = new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Critical"
          value={String(criticalCount)}
          sub={criticalCount > 0 ? 'Needs immediate attention' : 'All clear'}
          icon={
            <XCircle
              className={`h-4 w-4 ${criticalCount > 0 ? 'text-red-500' : 'text-muted'}`}
            />
          }
        />
        <StatCard
          label="Warning"
          value={String(warningCount)}
          sub={`Below ${WARN_THRESHOLD}% availability`}
          icon={
            <AlertTriangle
              className={`h-4 w-4 ${warningCount > 0 ? 'text-amber-500' : 'text-muted'}`}
            />
          }
        />
        <StatCard
          label="Machines Monitored"
          value={String(totalMachines)}
          sub="Last 24 hours"
          icon={<Activity className="h-4 w-4 text-muted" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Active Alerts"
          description={`Last 24 h · warn < ${WARN_THRESHOLD}% · critical < ${CRIT_THRESHOLD}%`}
          action={
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <RefreshCw className="h-3 w-3" />
              {lastUpdated}
            </span>
          }
        />

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="font-semibold">No active alerts</p>
              <p className="mt-0.5 text-sm text-muted">
                All {totalMachines} machines are within healthy thresholds.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {alerts.map((alert) => {
              const { Icon, badge, borderClass, iconClass, label } = severityConfig(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 border-l-4 px-4 py-4 ${borderClass}`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{alert.machineName}</span>
                      <Badge className={badge}>{label}</Badge>
                      {alert.type === 'offline' && (
                        <Badge className="bg-slate-100 text-slate-600">Offline</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted">{alert.lineId}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                      <span>
                        Availability:{' '}
                        <span className="font-medium text-foreground">
                          {formatPercent(alert.availability)}
                        </span>
                      </span>
                      <span>
                        Uptime:{' '}
                        <span className="font-medium text-foreground">
                          {alert.uptimeMinutes} min
                        </span>
                      </span>
                      <span>
                        Downtime:{' '}
                        <span className="font-medium text-foreground">
                          {alert.downtimeMinutes} min
                        </span>
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/factories/${factoryId}/machines/${alert.machineId}`}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    View →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
