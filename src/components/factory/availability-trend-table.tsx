'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { formatNumber, formatPercent } from '@/lib/utils';

const PAGE_SIZE = 10;

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
  const { data, isFetching } = useSuspenseQuery(machineDailyTrendQuery(factoryId, machineId, from, to));
  const { data: liveData, isPending: livePending } = useQuery(machineLiveDaysQuery(factoryId, machineId));

  const trends = useMemo<TrendRow[]>(() => {
    const dayMap = new Map(data.days.map((d) => [d.date.slice(0, 10), { ...d, is_live: false }]));
    if (liveData) {
      for (const d of liveData.days) {
        dayMap.set(d.date.slice(0, 10), { ...d, is_live: true });
      }
    }
    return [...dayMap.entries()].map(([key, d]) => ({
      dateKey:      key,
      dateLabel:    new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      availability: d.availability_percent,
      uptime:       d.uptime_minutes,
      downtime:     d.downtime_minutes,
      is_live:      d.is_live,
    }));
  }, [data, liveData]);

  const columns = useMemo<ColumnDef<TrendRow, unknown>[]>(() => [
    {
      id: 'date',
      accessorFn: (row) => row.dateKey, // sort chronologically by the day key
      header: 'Date',
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          {row.original.dateLabel}
          {row.original.is_live && <Badge className="bg-amber-50 text-amber-700 text-xs">Live</Badge>}
        </span>
      ),
    },
    {
      accessorKey: 'availability',
      header: 'Availability',
      cell: ({ row }) => (
        <Badge className={badgeColor(row.original.availability)}>{formatPercent(row.original.availability)}</Badge>
      ),
    },
    {
      accessorKey: 'uptime',
      header: 'Uptime (min)',
      cell: ({ row }) => formatNumber(row.original.uptime, 0),
    },
    {
      accessorKey: 'downtime',
      header: 'Downtime (min)',
      cell: ({ row }) => formatNumber(row.original.downtime, 0),
    },
    {
      id: 'total',
      accessorFn: (row) => row.uptime + row.downtime,
      header: 'Total (min)',
      cell: ({ row }) => formatNumber(row.original.uptime + row.original.downtime, 0),
    },
  ], []);

  if (isFetching || livePending) return <TableSkeleton rows={7} cols={5} />;

  return (
    <Card>
      <CardHeader
        title="Daily Availability Breakdown"
        description="Availability = uptime / (uptime + downtime) × 100% per day"
        action={
          <ExportCsvButton
            filename="daily-availability"
            headers={['Date', 'Availability (%)', 'Uptime (min)', 'Downtime (min)', 'Total Time (min)']}
            rows={trends.map((t) => [t.dateLabel, t.availability, t.uptime, t.downtime, t.uptime + t.downtime])}
          />
        }
      />

      <DataTable
        columns={columns}
        data={trends}
        pageSize={PAGE_SIZE}
        initialSorting={[{ id: 'date', desc: true }]}
        emptyMessage="No data available for the selected period."
      />
    </Card>
  );
}
