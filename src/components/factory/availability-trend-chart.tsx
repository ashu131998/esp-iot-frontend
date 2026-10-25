'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { format, parseISO, isToday as isTodayDate } from 'date-fns';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton } from '@/components/ui/page-skeletons';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { mergeTrendDays, trendDayRange } from '@/lib/trend-days';
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
  const shifts = useFactoryRefsOptional()?.shifts;
  const { data, isFetching } = useSuspenseQuery(machineDailyTrendQuery(factoryId, machineId, from, to, shifts));
  const { data: liveData, isPending: livePending } = useQuery(machineLiveDaysQuery(factoryId, machineId));

  const toDate = useMemo(() => {
    if (to) return parseISO(to);
    return new Date();
  }, [to]);
  const isShowingToday = isTodayDate(toDate);

  // One rule for the machine page's days (trend-days.ts): the chart, the table and
  // the performance trend show the same days with the same figures.
  const chartData = useMemo(
    () => mergeTrendDays(data.days, liveData?.days, trendDayRange(from, to)).map((d) => ({
      date:         new Date(`${d.key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      availability: d.availability_percent,
      is_live:      d.is_live,
    })),
    [data, liveData, from, to],
  );

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
      title: { text: 'Running time %', style: { fontWeight: 500 } },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      custom: ({ dataPointIndex }) => {
        const d = chartData[dataPointIndex];
        return `<div class="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
          <p class="font-medium">Date: ${d.date}${d.is_live ? ' (live)' : ''}</p>
          <p style="color:#3b82f6">Running time: ${formatNumber(d.availability, 1)}%</p>
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
        <CardHeader title="Running time, day by day" description="Nothing to show for these dates" />
        <div className="px-6 py-4 text-center text-sm text-muted">No availability data</div>
      </Card>
    );
  }

  const hasLive = chartData.some((d) => d.is_live);

  const timeRangeDescription = isShowingToday
    ? `Today from 12:00 AM to ${format(toDate, 'h:mm a')}`
    : 'How much this machine ran each day';

  return (
    <Card>
      <CardHeader
        title="Running time, day by day"
        description={`${timeRangeDescription}.${hasLive ? ' Orange dot = today, not finished yet.' : ''}`}
      />
      <div className="px-6 pb-6">
        <ApexChart type="line" series={[{ name: 'Running time %', data: chartData.map((d) => d.availability) }]} options={options} height={300} />
      </div>
    </Card>
  );
}
