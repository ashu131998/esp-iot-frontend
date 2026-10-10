'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { isLiveDateParams, resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs } from '@/lib/factory-refs-context';

/**
 * Reads the date range + machine filter from the URL (client-side, so it updates
 * the instant `router.push` runs — before any server round-trip) and resolves it
 * against the factory's min date from context. Use this in dashboard components
 * so they react to date changes immediately and key their queries consistently.
 */
export function useFactoryDateRange() {
  const sp = useSearchParams();
  const { minDate } = useFactoryRefs();

  const from = sp.get('from') ?? undefined;
  const to = sp.get('to') ?? undefined;
  const machineId = sp.get('machine_id') ?? undefined;
  const lineId = sp.get('line_id') ?? undefined;
  const live = isLiveDateParams({ from, to });

  const range = useMemo(
    () => resolveDateRange({ from, to }, minDate),
    [from, to, minDate],
  );

  /** Stable query-key fragment: 'live' while tracking now, else the fixed bounds. */
  const rangeKey = useMemo<[string, string]>(
    () => (live ? ['live', 'live'] : [range.from, range.to]),
    [live, range.from, range.to],
  );

  return { from, to, machineId, lineId, range, live, rangeKey, minDate };
}

export type FactoryScopeFilters = { machineId?: string; lineId?: string };

/** Query params for metrics endpoints that support server-side line filtering. */
export function factoryMetricsApiRange(
  range: { from: string; to: string },
  { lineId }: FactoryScopeFilters,
) {
  return { ...range, ...(lineId ? { line_id: lineId } : {}) };
}

/** Client-side narrow when API returns factory-wide rows or for single-machine selection. */
export function filterMachinesByScope<T extends { machine_id: string; line_id?: string }>(
  machines: T[],
  { machineId, lineId }: FactoryScopeFilters,
): T[] {
  let list = machines;
  if (lineId) list = list.filter((m) => m.line_id === lineId);
  if (machineId) list = list.filter((m) => m.machine_id === machineId);
  return list;
}

export function factoryScopeQueryKey({ lineId, machineId }: FactoryScopeFilters): [string, string] {
  return [lineId ?? '', machineId ?? ''];
}
