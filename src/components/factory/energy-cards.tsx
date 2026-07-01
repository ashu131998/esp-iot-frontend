'use client';

import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { useSuspenseQuery } from '@tanstack/react-query';

import { StatCard } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { DEFAULT_SHIFTS } from '@/lib/shifts';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { formatNumber } from '@/lib/utils';

const ENERGY_REFRESH_MS = 60_000;
const ENERGY_REFRESH_SEC = 60;

function getCurrentShiftName(from: string, to: string): string | null {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const now = new Date();

  const isLive = toDate.getTime() >= now.getTime() - 60_000;
  if (!isLive) return null;

  const shift = DEFAULT_SHIFTS.find((s) => s.start_hour === fromDate.getHours());
  return shift ? shift.name : null;
}

export function EnergyCards({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate } = useFactoryRefs();
  const { machineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate), [from, to, minDate]);

  const refetchInterval = useRefetchInterval(ENERGY_REFRESH_MS);

  const { data, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['energy', factoryId, from ?? 'live', to ?? 'live'],
    queryFn: ({ signal }) => api.energy(factoryId, range, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  useSetRefreshInfo(dataUpdatedAt, ENERGY_REFRESH_SEC);

  const displayMachines = machineId
    ? data.machines.filter((m) => m.machine_id === machineId)
    : data.machines;

  const totalEnergy = displayMachines.reduce((s, m) => s + (m.energy_kwh ?? 0), 0);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const shiftName = getCurrentShiftName(range.from, range.to);
  const timeLabel = shiftName ?? rangeLabel;

  return (
    <StatCard
      label="Total Energy Consumption"
      value={`${formatNumber(totalEnergy)} kWh`}
      sub={`${timeLabel} · estimated from current sensors${isFetching ? ' · updating…' : ''}`}
    />
  );
}
