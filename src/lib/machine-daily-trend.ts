import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import type { MachineDailyTrendResponse, MachineLiveDaysResponse } from '@/lib/types';

/**
 * Shared query config for a machine's per-day trend. The availability chart,
 * performance trend and availability table all use this same key/fn, so
 * React Query dedupes them into a single network request.
 *
 * Raw URL params (possibly undefined for live mode) are used as the key so
 * that new Date() is never called at key-construction time — only inside the
 * queryFn. This prevents React 18 concurrent-mode render retries from
 * generating slightly different timestamps and flooding the backend.
 */
export function machineDailyTrendQuery(
  factoryId: string,
  machineId: string,
  from: string | undefined,
  to: string | undefined,
) {
  return {
    queryKey: ['machine-daily-trend', factoryId, machineId, from ?? null, to ?? null] as const,
    queryFn: (): Promise<MachineDailyTrendResponse> => {
      // Use the same absolute window the stat cards use, so the trend and the
      // "Availability (today)" card agree. The backend buckets these instants
      // into IST calendar days.
      const range = resolveDateRange({ from, to });
      return api.machineDailyTrend(factoryId, machineId, { from: range.from, to: range.to });
    },
    staleTime: 5 * 60 * 1000,
  };
}

export function machineLiveDaysQuery(factoryId: string, machineId: string) {
  return {
    queryKey: ['machine-live-days', factoryId, machineId] as const,
    queryFn: (): Promise<MachineLiveDaysResponse> => api.machineLiveDays(factoryId, machineId),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  };
}
