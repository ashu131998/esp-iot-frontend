'use client';

import { useMemo } from 'react';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { machineDailyTrendQuery, machineLiveDaysQuery } from '@/lib/machine-daily-trend';
import { productionDayStart } from '@/lib/date-range';
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
  const { data } = useSuspenseQuery(machineDailyTrendQuery(factoryId, machineId, from, to));
  const { data: liveData } = useQuery(machineLiveDaysQuery(factoryId, machineId));

  const chartData = useMemo(() => {
    // IST calendar-day keys throughout (see availability-trend-chart for why).
    const today     = format(new Date(), 'yyyy-MM-dd');
    const rangeFrom = from ? from.slice(0, 10) : format(productionDayStart(), 'yyyy-MM-dd');
    const rangeTo   = to   ? to.slice(0, 10)   : today;

    const dayMap = new Map(
      data.days
        .filter((d) => { const k = d.date.slice(0, 10); return k >= rangeFrom && k <= rangeTo; })
        .map((d) => [d.date.slice(0, 10), { ...d }]),
    );
    if (liveData) {
      for (const d of liveData.days) {
        const key = d.date.slice(0, 10);
        if (key < rangeFrom || key > rangeTo) continue;
        const existing = dayMap.get(key);
        // For today: update availability from live (shift still in progress).
        // For past days: only fill in if shift_aggregates has no entry yet.
        if (key === today || !existing) {
          dayMap.set(key, {
            ...(existing ?? d),
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
        performance:  d.performance_percent,
        availability: d.availability_percent,
        throughput:   d.throughput_percent,
      }));
  }, [data, liveData, from, to]);

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
      x: { formatter: (_v, opts) => `Date: ${chartData[opts?.dataPointIndex ?? 0]?.date ?? ''}` },
      y: { formatter: (v) => (typeof v === 'number' ? `${formatNumber(v, 1)}%` : '—') },
    },
  }), [chartData]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader title="Performance Trend" description="No data available for the selected period" />
        <div className="px-6 py-4 text-center text-sm text-muted">No performance data</div>
      </Card>
    );
  }

  const series = [
    { name: 'Performance (P)', data: chartData.map((d) => d.performance) },
    { name: 'Availability (A)', data: chartData.map((d) => d.availability) },
    { name: 'Throughput (A×P)', data: chartData.map((d) => d.throughput) },
  ];

  return (
    <Card>
      <CardHeader
        title="Performance Trend"
        description="Daily Performance (P), Availability (A) and Throughput (A × P) over the selected period"
      />
      <div className="px-6 pb-6">
        <ApexChart type="line" series={series} options={options} height={300} />
      </div>
    </Card>
  );
}
