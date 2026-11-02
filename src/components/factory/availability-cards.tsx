'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Badge, StatCard } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { humanMinutes, periodPhrase, runTone, wholePercent } from '@/lib/plain-words';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { averageKnown, formatPercent } from '@/lib/utils';

const REFRESH_MS = 60_000;
const REFRESH_SEC = 60;

export function AvailabilityCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts } = useFactoryRefs();
  const { t, locale } = useT();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts), [from, to, minDate, shifts]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.availability(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, REFRESH_SEC);

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const machineCount = displayMachines.length;
  const totalUptime = displayMachines.reduce((s, m) => s + m.uptime_minutes, 0);
  const totalDowntime = displayMachines.reduce((s, m) => s + m.downtime_minutes, 0);
  const uptimeMin =
    machineCount > 0 ? totalUptime / machineCount : 0;
  const downtimeMin =
    machineCount > 0 ? totalDowntime / machineCount : 0;
  const avgAvailability =
    machineCount > 0
      ? averageKnown(displayMachines.map((m) => m.availability_percent))
      : data.avg_availability_percent;
  const multiMachine = machineCount > 1;
  const up = humanMinutes(uptimeMin, t);
  const down = humanMinutes(downtimeMin, t);
  const timeSubtitle = multiMachine
    ? t('Average per machine: ran {up} · stopped {down}', { up, down })
    : t('Ran {up} · stopped {down}', { up, down });
  const period = t(periodPhrase(from, to));

  return (
    <>
      <SummaryCard
        tone={runTone(avgAvailability)}
        badge={wholePercent(avgAvailability)}
        title={
          avgAvailability == null
            ? t('No running data yet')
            : multiMachine
              ? t('On average, machines ran {pct} of {period}', { pct: wholePercent(avgAvailability), period })
              : t('Machine ran {pct} of {period}', { pct: wholePercent(avgAvailability), period })
        }
        subtitle={timeSubtitle}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={multiMachine ? t('Avg uptime per machine') : t('Uptime')}
          value={up}
        />
        <StatCard
          label={multiMachine ? t('Avg downtime per machine') : t('Downtime')}
          value={down}
        />
      </div>

      {data.by_shift && data.by_shift.length > 0 && !machineId && (
        <Card>
          <CardHeader title={t('Availability by Shift')} description={t('Last completed 12-hour shift per schedule')} />
          <div className="grid gap-4 sm:grid-cols-2">
            {data.by_shift.map((s) => (
              <div key={s.shift_id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{t(s.name)}</h4>
                  <Badge className="bg-blue-50 text-blue-700">{s.label}</Badge>
                </div>
                <p className="mt-2 text-2xl font-bold">{formatPercent(s.avg_availability_percent, locale)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
