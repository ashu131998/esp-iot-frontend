'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { endOfDay, format, isToday, parseISO, startOfDay } from 'date-fns';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useRefetchInterval } from '@/lib/refresh-context';
import { formatNumber } from '@/lib/utils';

export function FactoryAvailabilityTrend({
  factoryId,
  from,
  to,
}: {
  factoryId: string;
  from?: string;
  to?: string;
}) {
  // Truncate to the current minute so the query key (and toIso) stays stable
  // across Suspense remounts — millisecond differences would otherwise bust the
  // cache and fire a new request on every render cycle.
  const now = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  }, []);

  // Derive calendar-day boundaries from the selected date range.
  // "from" always snaps to 00:00 of that calendar day.
  // "to" uses now when the range ends today; otherwise end-of-day so every
  // completed past day is fully included.
  const { fromIso, toIso } = useMemo(() => {
    const fromDate = from ? startOfDay(parseISO(from)) : startOfDay(now);
    const toDate = to ? (isToday(parseISO(to)) ? now : endOfDay(parseISO(to))) : now;
    return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() };
  }, [from, to, now]);

  const refetchInterval = useRefetchInterval(60_000);

  const { data } = useSuspenseQuery({
    queryKey: ['factory-daily-availability', factoryId, 'trend', fromIso, toIso],
    queryFn: ({ signal }) =>
      api.factoryDailyAvailability(factoryId, { from: fromIso, to: toIso }, { signal }),
    refetchInterval,
    staleTime: 60 * 1000,
  });

  const chartData = useMemo(
    () =>
      data.days.map((d) => ({
        // d.date is an IST-day ISO (…+05:30); format from the day key so the
        // label is the IST calendar day regardless of the viewer's timezone.
        date:         new Date(`${d.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        availability: d.availability_percent,
        is_live:      d.is_live ?? false,
      })),
    [data],
  );

  const options = useMemo<ApexOptions>(() => ({
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'line' },
    colors: ['#10b981'],
    stroke: { curve: 'smooth', width: 2 },
    markers: {
      size: 4,
      colors: ['#10b981'],
      strokeColors: '#059669',
      strokeWidth: 1.5,
      hover: { size: 6 },
      discrete: chartData.flatMap((d, i) =>
        d.is_live
          ? [{ seriesIndex: 0, dataPointIndex: i, fillColor: '#f59e0b', strokeColor: '#d97706', size: 5 }]
          : [],
      ),
    },
    xaxis: {
      categories: chartData.map((d) => d.date),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      title: { text: 'Availability %', style: { fontWeight: 500 } },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      custom: ({ dataPointIndex }) => {
        const d = chartData[dataPointIndex];
        return `<div class="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
          <p class="font-medium">Date: ${d.date}${d.is_live ? ' (live)' : ''}</p>
          <p style="color:#10b981">Availability: ${formatNumber(d.availability, 1)}%</p>
        </div>`;
      },
    },
  }), [chartData]);

  const hasLive = chartData.some((d) => d.is_live);

  const timeRangeDescription = hasLive
    ? `Average machine availability per day · live through ${format(now, 'h:mm a')}`
    : 'Average machine availability per day';

  return (
    <Card>
      <CardHeader
        title="Factory Availability Trend"
        description={`${timeRangeDescription}.${hasLive ? ' Orange dots = live (computed from raw readings, no completed shift yet).' : ''}`}
      />
      {chartData.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">
          No data available for the selected period.
        </p>
      ) : (
        <div className="px-6 pb-6">
          <ApexChart type="line" series={[{ name: 'Availability %', data: chartData.map((d) => d.availability) }]} options={options} height={300} />
        </div>
      )}
    </Card>
  );
}
