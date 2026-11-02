'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { TBody, TD, THead, TH, TR } from '@/components/ui/table';
import { LoadMore, ScrollTable, useShowMore } from '@/components/ui/load-more';
import { api } from '@/lib/api';
import { formatUpTo } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { formatPercent, formatUnits } from '@/lib/utils';

export function PerformanceTable({ factoryId }: { factoryId: string }) {
  const { t, locale } = useT();
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['performance', factoryId, live ? 'live' : range.from, live ? 'live' : range.to, ...scopeKey],
    queryFn: ({ signal }) => api.performance(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const allMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const total = allMachines.length;
  // Infinite scroll: the first rows, then more as the table's end comes into view (all are loaded).
  const listKey = [live ? 'live' : range.from, live ? 'live' : range.to, ...scopeKey].join('|');
  const { shown, more, hasMore } = useShowMore(total, listKey);
  const pageRows = allMachines.slice(0, shown);
  const mixedWord = t('(mixed units)');

  return (
    <Card>
      <CardHeader
        title={t('Machine Performance')}
        action={
          <ExportCsvButton
            filename="machine-performance"
            headers={[
              t('Machine'),
              t('Line'),
              t('Performance (A × T)'),
              t('Availability (A)'),
              t('Throughput (T)'),
              t('Units Produced'),
              t('Target Units'),
              t('Cycle Target (s)'),
            ]}
            rows={allMachines.map((m) => [
              m.machine_name,
              m.line_id,
              m.performance_percent,
              m.availability_percent,
              m.throughput_percent,
              m.units_produced,
              m.target_units > 0 ? m.target_units : null,   // no target set: blank, not 0
              m.target_cycle_time_sec,
            ])}
          />
        }
      />
      <ScrollTable rowCount={pageRows.length} resetKey={listKey}>
        <THead>
          <TR>
            <TH>{t('Machine')}</TH>
            <TH>{t('Line')}</TH>
            <TH>{t('Performance (A × T)')}</TH>
            <TH>{t('Availability (A)')}</TH>
            <TH>{t('Throughput (T)')}</TH>
            <TH>{t('Units / Target')}</TH>
            <TH>{t('Cycle Target')}</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{m.line_id}</TD>
              <TD>{formatPercent(m.performance_percent, locale)}</TD>
              <TD>{formatPercent(m.availability_percent, locale)}</TD>
              <TD>{formatPercent(m.throughput_percent, locale)}</TD>
              <TD>
                {formatUnits(m.units_produced, m.unit_label, locale, mixedWord)} / {m.target_units > 0 ? formatUnits(m.target_units, m.unit_label, locale, mixedWord) : '—'}
              </TD>
              <TD>{m.target_cycle_time_sec ? `${formatUpTo(m.target_cycle_time_sec, 2, locale)}s` : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </ScrollTable>
      <LoadMore shown={shown} total={total} hasMore={hasMore} onMore={more} />
    </Card>
  );
}
