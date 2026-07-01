'use client';

import { useState } from 'react';
import { ApexChart, baseChartOptions, formatAxisTick, type ApexOptions } from './apex';

interface ChartData {
  name: string;
  [key: string]: string | number;
}

interface MetricBarChartProps {
  data: ChartData[];
  bars: Array<{ key: string; color: string; label: string }>;
  height?: number;
}

function barOptions(
  data: ChartData[],
  series: Array<{ key: string; color: string; label: string }>,
  stacked: boolean,
): ApexOptions {
  return {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'bar', stacked },
    colors: series.map((s) => s.color),
    plotOptions: {
      bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '60%' },
    },
    xaxis: {
      categories: data.map((d) => d.name),
      labels: { style: { fontSize: '11px' }, rotate: 0, hideOverlappingLabels: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: '11px' }, formatter: (v) => formatAxisTick(v) },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      y: { formatter: (v) => Number(v).toLocaleString() },
    },
  };
}

export function MetricBarChart({ data, bars, height = 320 }: MetricBarChartProps) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No chart data available</p>;
  }

  const series = bars.map((bar) => ({
    name: bar.label,
    data: data.map((row) => Number(row[bar.key]) || 0),
  }));

  return <ApexChart type="bar" series={series} options={barOptions(data, bars, false)} height={height} />;
}

interface StackedBarChartProps {
  data: ChartData[];
  keys: Array<{ key: string; color: string; label: string }>;
  height?: number;
}

export function StackedBarChart({ data, keys, height = 320 }: StackedBarChartProps) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No chart data available</p>;
  }

  const series = keys.map((k) => ({
    name: k.label,
    data: data.map((row) => Number(row[k.key]) || 0),
  }));

  return <ApexChart type="bar" series={series} options={barOptions(data, keys, true)} height={height} />;
}

const UPTIME_UP_COLOR = '#10b981';
const UPTIME_DOWN_COLOR = '#ef4444';

export interface UptimeSegmentPoint {
  from: string;
  to: string;
  duration_seconds: number;
  status: 'up' | 'down';
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function UptimeSegmentTooltip({ segment }: { segment: UptimeSegmentPoint }) {
  return (
    <div className="pointer-events-none z-20 min-w-[240px] rounded-md border bg-white px-3 py-2.5 text-xs shadow-md">
      <p
        className="mb-2 font-semibold"
        style={{ color: segment.status === 'up' ? UPTIME_UP_COLOR : UPTIME_DOWN_COLOR }}
      >
        {segment.status === 'up' ? 'Up' : 'Down'} · {formatDuration(segment.duration_seconds)}
      </p>
      <dl className="space-y-1.5 text-muted">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide">From</dt>
          <dd className="font-mono text-[11px] text-foreground">{formatTimestamp(segment.from)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide">To</dt>
          <dd className="font-mono text-[11px] text-foreground">{formatTimestamp(segment.to)}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Proportional time-series strip: segment width reflects real elapsed time over
 * the query window (second-resolution status, rendered as contiguous blocks).
 * Pure layout — no chart library needed.
 */
export function UptimeTimeSeriesChart({
  segments,
  windowFrom,
  windowTo,
  windowLabel,
  height = 48,
}: {
  segments: UptimeSegmentPoint[];
  windowFrom: string;
  windowTo: string;
  windowLabel?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<{ segment: UptimeSegmentPoint; index: number } | null>(null);

  const windowMs = Math.max(new Date(windowTo).getTime() - new Date(windowFrom).getTime(), 1);
  const spanDays = windowMs / 86400000;
  const axisFormat =
    spanDays > 2
      ? { month: 'short' as const, day: 'numeric' as const }
      : { hour: '2-digit' as const, minute: '2-digit' as const };

  if (segments.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No uptime data available</p>;
  }

  const axisLabels = [windowFrom, windowTo].map((iso) =>
    new Date(iso).toLocaleString(undefined, axisFormat),
  );

  const hoverCenterPct = hover
    ? segments.slice(0, hover.index).reduce(
        (acc, s) => acc + (s.duration_seconds * 1000 / windowMs) * 100,
        0,
      ) + (hover.segment.duration_seconds * 1000 / windowMs) * 50
    : 0;

  return (
    <div className="space-y-1">
      <div className="relative">
        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-20 mb-2"
            style={{ left: `${hoverCenterPct}%`, transform: 'translateX(-50%)' }}
          >
            <UptimeSegmentTooltip segment={hover.segment} />
          </div>
        )}
        <div
          className="flex w-full overflow-hidden rounded-md border border-slate-200"
          style={{ height }}
          role="img"
          aria-label={`Machine status timeline for ${windowLabel ?? 'selected period'}`}
        >
          {segments.map((seg, i) => {
            const widthPct = (seg.duration_seconds * 1000 / windowMs) * 100;
            if (widthPct <= 0) return null;
            return (
              <div
                key={`${seg.from}-${i}`}
                className="h-full shrink-0 transition-opacity hover:opacity-80"
                style={{
                  width: `${widthPct}%`,
                  minWidth: widthPct > 0 ? 1 : 0,
                  backgroundColor: seg.status === 'up' ? UPTIME_UP_COLOR : UPTIME_DOWN_COLOR,
                }}
                onMouseEnter={() => setHover({ segment: seg, index: i })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{axisLabels[0]}</span>
        <span>{windowLabel ?? 'selected period'}</span>
        <span>{axisLabels[1]}</span>
      </div>
    </div>
  );
}

interface UptimePoint {
  label: string;
  status: 'up' | 'down';
}

/**
 * Timeline strip of equal-width bars, one per time bucket, colored green when
 * the machine is up and red when it is down.
 */
export function UptimeTimelineChart({
  data,
  height = 80,
}: {
  data: UptimePoint[];
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No uptime data available</p>;
  }

  const series = [{ name: 'Status', data: data.map(() => 1) }];
  const colors = data.map((d) => (d.status === 'up' ? UPTIME_UP_COLOR : UPTIME_DOWN_COLOR));

  const options: ApexOptions = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'bar', animations: { enabled: false } },
    legend: { show: false },
    grid: { show: false, padding: { left: 0, right: 8, top: 4, bottom: 0 } },
    colors,
    plotOptions: {
      bar: { distributed: true, borderRadius: 2, borderRadiusApplication: 'end', columnWidth: '98%' },
    },
    xaxis: {
      categories: data.map((d) => d.label),
      labels: { style: { fontSize: '10px' }, hideOverlappingLabels: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickPlacement: 'on',
    },
    yaxis: { show: false, min: 0, max: 1 },
    tooltip: {
      ...baseChartOptions.tooltip,
      custom: ({ dataPointIndex }) => {
        const point = data[dataPointIndex];
        const color = point.status === 'up' ? UPTIME_UP_COLOR : UPTIME_DOWN_COLOR;
        return `<div class="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
          <p class="font-medium">${point.label}</p>
          <p style="color:${color}">${point.status === 'up' ? 'Up' : 'Down'}</p>
        </div>`;
      },
    },
  };

  return <ApexChart type="bar" series={series} options={options} height={height} />;
}
