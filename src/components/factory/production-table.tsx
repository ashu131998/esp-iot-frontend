'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { PHONE_HIDDEN, TBody, TD, THead, TH, TR } from '@/components/ui/table';
import { LoadMore, ScrollTable, useShowMore } from '@/components/ui/load-more';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs, useLineName } from '@/lib/factory-refs-context';
import { formatInt } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { cn, formatUnits } from '@/lib/utils';
import { ListRow, PhoneRows } from '@/components/ui/simple';

export function ProductionTable({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const { minDate, shifts, maxDate } = useFactoryRefs();
  const lineName = useLineName();
  const { t, locale } = useT();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts, maxDate), [from, to, minDate, shifts, maxDate]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['production', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
    queryFn: ({ signal }) => api.production(factoryId, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const total = displayMachines.length;
  // Infinite scroll: the first rows, then more as the table's end comes into view (all are loaded).
  const listKey = [from, to, ...scopeKey].join('|');
  const { shown, more, hasMore } = useShowMore(total, listKey);
  const pageRows = displayMachines.slice(0, shown);
  const mixedWord = t('(mixed units)');

  return (
    <Card>
      <CardHeader
        title={t('Machine Production')}
        action={
          <div className="flex items-center gap-3">
            <ExportCsvButton
              filename="machine-production"
              headers={[t('Machine'), t('Line'), t('Units Produced'), t('Unit'), t('Sensor'), t('Data Points')]}
              rows={displayMachines.map((m) => [
                m.machine_name,
                lineName(m.line_id),
                m.units_produced,
                m.unit_label ?? t('units'),
                m.device_id,
                m.data_points,
              ])}
            />
          </div>
        }
      />
      <PhoneRows>
        {pageRows.map((m) => (
          <ListRow
            key={m.machine_id}
            href={`/factories/${factoryId}/machines/${m.machine_id}`}
            title={m.machine_name}
            tag={lineName(m.line_id)}
            detail={m.status === 'no_sensor' ? t('No proximity sensor') : t('{count} readings', { count: m.data_points != null ? formatInt(m.data_points, locale) : '0' })}
            value={formatUnits(m.units_produced, m.unit_label, locale, mixedWord)}
          />
        ))}
      </PhoneRows>
      <ScrollTable className="hidden sm:block" rowCount={pageRows.length} resetKey={listKey}>
        <THead>
          <TR>
            <TH>{t('Machine')}</TH>
            <TH>{t('Line')}</TH>
            <TH>{t('Units Produced')}</TH>
            <TH className={PHONE_HIDDEN}>{t('Sensor')}</TH>
            <TH>{t('Data Points')}</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{lineName(m.line_id)}</TD>
              <TD className="font-semibold">{formatUnits(m.units_produced, m.unit_label, locale, mixedWord)}</TD>
              <TD className={cn('font-mono text-xs', PHONE_HIDDEN)}>{m.device_id ?? '—'}</TD>
              <TD>{m.data_points != null ? formatInt(m.data_points, locale) : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </ScrollTable>
      <LoadMore shown={shown} total={total} hasMore={hasMore} onMore={more} />
    </Card>
  );
}
