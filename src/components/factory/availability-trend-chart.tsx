'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { format, parseISO, isToday as isTodayDate } from 'date-fns';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton } from '@/components/ui/page-skeletons';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { productionDayStart } from '@/lib/date-range';
import { formatNumber } from '@/lib/utils';

export function AvailabilityTrendChart({
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

  const toDate = useMemo(() => {
    if (to) return parseISO(to);
    return new Date();
  }, [to]);
  const isShowingToday = isTodayDate(toDate);

  const chartData = useMemo(() => {
    // All keys are IST calendar days. The backend returns `date` as an IST-day
    // ISO (…+05:30); the raw URL params are IST wall-clock — so slicing the
    // first 10 chars of either yields the same day key with no UTC drift.
    const today     = format(new Date(), 'yyyy-MM-dd');
    const rangeFrom = from ? from.slice(0, 10) : format(productionDayStart(), 'yyyy-MM-dd');
    const rangeTo   = to   ? to.slice(0, 10)   : today;

    const dayMap = new Map(
      data.days
        .filter((d) => { const k = d.date.slice(0, 10); return k >= rangeFrom && k <= rangeTo; })
        .map((d) => [d.date.slice(0, 10), { availability_percent: d.availability_percent, is_live: false as boolean }]),
    );
    if (liveData) {
      for (const d of liveData.days) {
        const key = d.date.slice(0, 10);
        if (key < rangeFrom || key > rangeTo) continue;
        const existing = dayMap.get(key);
        if (key === today || !existing) {
          dayMap.set(key, {
            availability_percent: d.availability_percent,
            is_live: key === today,
          });
        }
      }
    }
    return [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({
        date:         new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        availability: d.availability_percent,
        is_live:      d.is_live,
      }));
  }, [data, liveData, from, to]);

  const options = useMemo<ApexOptions>(() => ({
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'line' },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth', width: 2 },
    markers: {
      size: 4,
      colors: ['#3b82f6'],
      strokeColors: '#2563eb',
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
          <p style="color:#3b82f6">Availability: ${formatNumber(d.availability, 1)}%</p>
        </div>`;
      },
    },
  }), [chartData]);

  if (isFetching || livePending) {
    return <ChartSkeleton />;
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader title="Availability Trend" description="No data available for the selected period" />
        <div className="px-6 py-4 text-center text-sm text-muted">No availability data</div>
      </Card>
    );
  }

  const hasLive = chartData.some((d) => d.is_live);

  const timeRangeDescription = isShowingToday
    ? `12:00 AM to ${format(toDate, 'h:mm a')} today`
    : 'Daily availability percentage over the selected period';

  return (
    <Card>
      <CardHeader
        title="Availability Trend"
        description={`${timeRangeDescription}.${hasLive ? ' Orange dots = live / in-progress data from readings.' : ''}`}
      />
      <div className="px-6 pb-6">
        <ApexChart type="line" series={[{ name: 'Availability %', data: chartData.map((d) => d.availability) }]} options={options} height={300} />
      </div>
    </Card>
  );
}
