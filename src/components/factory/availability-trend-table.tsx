'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { DataTable } from '@/components/ui/data-table';
import { SCROLL_STEP } from '@/lib/infinite';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { dayKeyToDate, formatWeekdayDayMonth, todayKey } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { mergeTrendDays, trendDayRange } from '@/lib/trend-days';
import { humanMinutes } from '@/lib/plain-words';
import { formatPercent } from '@/lib/utils';


function badgeColor(v: number | null): string {
  if (v == null) return 'bg-gray-50 text-gray-700';
  if (v >= 95)   return 'bg-green-50 text-green-700';
  if (v >= 85)   return 'bg-yellow-50 text-yellow-700';
  return 'bg-red-50 text-red-700';
}

interface TrendRow {
  dateKey: string;
  dateLabel: string;
  availability: number | null;
  uptime: number;
  downtime: number;
  is_live: boolean;
}

export function AvailabilityTrendTable({
  factoryId,
  machineId,
  from,
  to,
}: {
  factoryId: string;
  machineId: string;
  from?: string;
  to?: string;
}) {
  const shifts = useFactoryRefsOptional()?.shifts;
  const { t, locale } = useT();
  const { data, isFetching } = useSuspenseQuery(machineDailyTrendQuery(factoryId, machineId, from, to, shifts));
  const { data: liveData, isPending: livePending } = useQuery(machineLiveDaysQuery(factoryId, machineId));

  // The same days and figures as the chart above it (trend-days.ts): within the
  // selected range, a saved day as saved, today and unsaved days from live.
  const trends = useMemo<TrendRow[]>(
    () => mergeTrendDays(data.days, liveData?.days, trendDayRange(from, to)).map((d) => ({
      dateKey:      d.key,
      dateLabel:    formatWeekdayDayMonth(dayKeyToDate(d.key), locale),
      availability: d.availability_percent,
      uptime:       d.uptime_minutes,
      downtime:     d.downtime_minutes,
      is_live:      d.from_live,
    })),
    [data, liveData, from, to, locale],
  );

  const columns = useMemo<ColumnDef<TrendRow, unknown>[]>(() => [
    {
      id: 'date',
      accessorFn: (row) => row.dateKey, // sort chronologically by the day key
      header: t('Date'),
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          {row.original.dateLabel}
          {row.original.is_live && (
            <Badge className="hidden bg-amber-50 text-amber-700 text-xs sm:inline-flex">
              {row.original.dateKey === todayKey() ? t('Today') : t('Not final yet')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'availability',
      header: t('Availability'),
      cell: ({ row }) => (
        <Badge className={badgeColor(row.original.availability)}>{formatPercent(row.original.availability, locale)}</Badge>
      ),
    },
    {
      accessorKey: 'uptime',
      header: t('Uptime'),
      meta: { phoneHidden: true },
      cell: ({ row }) => humanMinutes(row.original.uptime, t),
    },
    {
      accessorKey: 'downtime',
      header: t('Downtime'),
      meta: { phoneHidden: true },
      cell: ({ row }) => humanMinutes(row.original.downtime, t),
    },
    {
      id: 'total',
      accessorFn: (row) => row.uptime + row.downtime,
      header: t('Total'),
      meta: { phoneHidden: true },
      cell: ({ row }) => humanMinutes(row.original.uptime + row.original.downtime, t),
    },
  ], [t, locale]);

  if (isFetching || livePending) return <TableSkeleton rows={7} cols={5} />;

  return (
    <Card>
      <CardHeader
        title={t('Daily Availability Breakdown')}
        description={t('Availability = uptime / (uptime + downtime) × 100% per day')}
        action={
          <ExportCsvButton
            filename="daily-availability"
            headers={[t('Date'), t('Availability (%)'), t('Uptime (min)'), t('Downtime (min)'), t('Total Time (min)')]}
            rows={trends.map((row) => [row.dateLabel, row.availability, row.uptime, row.downtime, row.uptime + row.downtime])}
          />
        }
      />

      <DataTable
        columns={columns}
        data={trends}
        scrollStep={SCROLL_STEP}
        initialSorting={[{ id: 'date', desc: true }]}
        emptyMessage={t('No data available for the selected period.')}
      />
    </Card>
  );
}
