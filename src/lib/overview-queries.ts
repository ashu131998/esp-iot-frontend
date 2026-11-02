/**
 * The react-query keys of the factory overview's figures, shared by the page (which fetches them
 * on the server so the first screen arrives with its numbers) and the stat cards (which read and
 * refresh them in the browser). One place, so the two can never drift apart: a key that differed
 * by one character would make the browser fetch everything again behind a skeleton.
 */

export type OverviewMetric = 'availability' | 'energy' | 'production' | 'performance';

export interface OverviewScope {
  from?: string;
  to?: string;
  lineId?: string;
  machineId?: string;
}

export function overviewQueryKey(metric: OverviewMetric, factoryId: string, scope: OverviewScope) {
  return [metric, factoryId, scope.from ?? 'live', scope.to ?? 'live', scope.lineId ?? '', scope.machineId ?? ''] as const;
}
