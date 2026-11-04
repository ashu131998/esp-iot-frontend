'use client';

import { useMemo } from 'react';
import { useSuspenseQueries } from '@tanstack/react-query';

import { MachineStatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { PHONE_HIDDEN, TBody, TD, THead, TH, TR } from '@/components/ui/table';
import { LoadMore, ScrollTable, useShowMore } from '@/components/ui/load-more';
import { api } from '@/lib/api';
import { resolveDateRange } from '@/lib/date-range';
import { useFactoryRefs, useLineName } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval } from '@/lib/refresh-context';
import {
  factoryMetricsApiRange,
  factoryScopeQueryKey,
  filterMachinesByScope,
  useFactoryDateRange,
} from '@/lib/use-factory-date-range';
import { expandUptimeMachines } from '@/lib/uptime-streams';
import { STATE_TONE, humanMinutes, machineState } from '@/lib/plain-words';
import { formatPercent, statusLabel } from '@/lib/utils';
import { ListRow, PhoneRows } from '@/components/ui/simple';
import { useFactoryHref } from '@/lib/factory-links-context';

export function AvailabilityMachineTable({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  const link = useFactoryHref();
  const { minDate, shifts, maxDate } = useFactoryRefs();
  const lineName = useLineName();
  const { t, locale } = useT();
  const { machineId, lineId } = useFactoryDateRange();
  const range = useMemo(() => resolveDateRange({ from, to }, minDate, shifts, maxDate), [from, to, minDate, shifts, maxDate]);
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });

  const refetchInterval = useRefetchInterval(60_000);

  // Both queries fire in parallel — availability and uptime no longer waterfall
  const [{ data }, { data: uptimeData }] = useSuspenseQueries({
    queries: [
      {
        queryKey: ['availability', factoryId, from ?? 'live', to ?? 'live', ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => api.availability(factoryId, apiRange, { signal }),
        refetchInterval,
        staleTime: 0,
      },
      {
        queryKey: ['uptime-24h', factoryId, ...scopeKey],
        queryFn: ({ signal }: { signal: AbortSignal }) => {
          const now = new Date();
          const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          return api.uptime(
            factoryId,
            {
              from: from24h,
              to: now.toISOString(),
              ...(machineId ? { machine_id: machineId } : {}),
              ...(lineId ? { line_id: lineId } : {}),
            },
            { signal },
          );
        },
        refetchInterval,
        staleTime: 0,
      },
    ],
  });

  const displayMachines = filterMachinesByScope(data.machines, { machineId, lineId });

  const total = displayMachines.length;
  // Infinite scroll: the first rows, then more as the table's end comes into view (all are loaded).
  const listKey = [from, to, ...scopeKey].join('|');
  const { shown, more, hasMore } = useShowMore(total, listKey);
  const pageRows = displayMachines.slice(0, shown);

  const uptimeByMachine = Object.fromEntries(uptimeData.machines.map((m) => [m.machine_id, m]));
  const uptimeRowsByMachine = Object.fromEntries(
    uptimeData.machines.map((m) => [m.machine_id, expandUptimeMachines([m])]),
  );

  return (
    <Card>
      <CardHeader
        title={t('Machine Availability')}
        action={
          <ExportCsvButton
            filename="machine-availability"
            headers={[t('Machine'), t('Line'), t('Uptime (min)'), t('Downtime (min)'), t('Availability'), t('Current Status')]}
            rows={displayMachines.map((m) => [
              m.machine_name,
              lineName(m.line_id),
              m.uptime_minutes,
              m.downtime_minutes,
              m.availability_percent,
              t(statusLabel(uptimeByMachine[m.machine_id]?.timeline.at(-1)?.status ?? 'no_data')),
            ])}
          />
        }
      />
      <PhoneRows>
        {pageRows.map((m) => (
          <ListRow
            key={m.machine_id}
            href={link(`/factories/${factoryId}/machines/${m.machine_id}`)}
            tone={STATE_TONE[machineState(uptimeByMachine[m.machine_id]?.timeline.at(-1)?.status ?? 'no_data')]}
            title={m.machine_name}
            tag={lineName(m.line_id)}
            detail={t('Ran {up} · stopped {down}', { up: humanMinutes(m.uptime_minutes, t), down: humanMinutes(m.downtime_minutes, t) })}
            value={formatPercent(m.availability_percent, locale)}
            valueHint={m.availability_percent != null ? t('running') : undefined}
          />
        ))}
      </PhoneRows>
      <ScrollTable className="hidden sm:block" rowCount={pageRows.length} resetKey={listKey}>
        <THead>
          <TR>
            <TH>{t('Machine')}</TH>
            <TH>{t('Line')}</TH>
            <TH>{t('Uptime')}</TH>
            <TH>{t('Downtime')}</TH>
            <TH>{t('Availability')}</TH>
            <TH className={PHONE_HIDDEN}>{t('Last 24h')}</TH>
            <TH>{t('Current Status')}</TH>
          </TR>
        </THead>
        <TBody>
          {pageRows.map((m) => (
            <TR key={m.machine_id}>
              <TD className="font-medium">{m.machine_name}</TD>
              <TD>{lineName(m.line_id)}</TD>
              <TD>{humanMinutes(m.uptime_minutes, t)}</TD>
              <TD>{humanMinutes(m.downtime_minutes, t)}</TD>
              <TD>{formatPercent(m.availability_percent, locale)}</TD>
              <TD className={PHONE_HIDDEN}>
                {(uptimeRowsByMachine[m.machine_id]?.length ?? 0) > 1 ? (
                  <div className="flex flex-col gap-1">
                    {uptimeRowsByMachine[m.machine_id]?.map((row) => (
                      <div key={row.stream_key} className="flex items-center gap-2">
                        <span className="max-w-[6rem] truncate text-[10px] text-muted">
                          {row.label || row.display_name}
                        </span>
                        <MiniTimeline segments={row.timeline ?? []} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <MiniTimeline segments={uptimeByMachine[m.machine_id]?.timeline ?? []} />
                )}
              </TD>
              <TD>
                <MachineStatusBadge status={uptimeByMachine[m.machine_id]?.timeline.at(-1)?.status ?? 'no_data'} />
              </TD>
            </TR>
          ))}
        </TBody>
      </ScrollTable>
      <LoadMore shown={shown} total={total} hasMore={hasMore} onMore={more} />
    </Card>
  );
}
