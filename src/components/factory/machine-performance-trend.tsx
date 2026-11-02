'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { ChartSkeleton } from '@/components/ui/page-skeletons';
import { dayKeyToDate, formatDayMonth } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { mergeTrendDays, trendDayRange } from '@/lib/trend-days';
import { formatNumber } from '@/lib/utils';

export function MachinePerformanceTrend({
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

  // Each day whole from one source (trend-days.ts): today's performance is never a
  // saved part-day's beside today's live availability.
  const chartData = useMemo(
    () => mergeTrendDays(data.days, liveData?.days, trendDayRange(from, to)).map((d) => ({
      date:         formatDayMonth(dayKeyToDate(d.key), locale),
      performance:  d.performance_percent,
      availability: d.availability_percent,
      throughput:   d.throughput_percent,
    })),
    [data, liveData, from, to, locale],
  );

  const options = useMemo<ApexOptions>(() => ({
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'line' },
    colors: ['#6366f1', '#10b981', '#3b82f6'],
    stroke: { curve: 'smooth', width: 2 },
    markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
    xaxis: {
      categories: chartData.map((d) => d.date),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      title: { text: '%', style: { fontWeight: 500 } },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      shared: true,
      intersect: false,
      x: { formatter: (_v, opts) => t('Date: {date}', { date: chartData[opts?.dataPointIndex ?? 0]?.date ?? '' }) },
      y: { formatter: (v) => (typeof v === 'number' ? `${formatNumber(v, 1, locale)}%` : '—') },
    },
  }), [chartData, t, locale]);

  if (isFetching || livePending) return <ChartSkeleton />;

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader title={t('Performance Trend')} description={t('No data available for the selected period')} />
        <div className="px-6 py-4 text-center text-sm text-muted">{t('No performance data')}</div>
      </Card>
    );
  }

  const series = [
    { name: t('Performance (P)'), data: chartData.map((d) => d.performance) },
    { name: t('Availability (A)'), data: chartData.map((d) => d.availability) },
    { name: t('Throughput (A×P)'), data: chartData.map((d) => d.throughput) },
  ];

  return (
    <Card>
      <CardHeader
        title={t('Performance Trend')}
        description={t('Daily Performance (P), Availability (A) and Throughput (A × P) over the selected period')}
      />
      <div className="px-6 pb-6">
        <ApexChart type="line" series={series} options={options} height={300} />
      </div>
    </Card>
  );
}
