'use client';

import { useState } from 'react';
import { knownNumber, normalizeMachineStatus, statusLabel } from '@/lib/utils';
import { ApexChart, baseChartOptions, formatAxisTick, type ApexOptions } from './apex';
import { placeMarks, placeSegments } from '@/lib/timeline-layout';

interface ChartData {
  name: string;
  /** null = unknown: drawn as no bar, never as 0. */
  [key: string]: string | number | null;
}

interface MetricBarChartProps {
  data: ChartData[];
  bars: Array<{ key: string; color: string; label: string }>;
  height?: number;
  /** When many categories (e.g. 20 looms), rotate and show every label. */
  xLabelRotate?: number;
  showAllXLabels?: boolean;
}

function barOptions(
  data: ChartData[],
  series: Array<{ key: string; color: string; label: string }>,
  stacked: boolean,
  xLabelRotate = 0,
  showAllXLabels = false,
): ApexOptions {
  const manyCategories = data.length > 8;
  const rotate = xLabelRotate || (manyCategories ? -45 : 0);
  const hideOverlapping = showAllXLabels ? false : !manyCategories;

  return {
    ...baseChartOptions,
    chart: {
      ...baseChartOptions.chart,
      type: 'bar',
      stacked,
      toolbar: { show: false },
    },
    colors: series.map((s) => s.color),
    plotOptions: {
      bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: manyCategories ? '75%' : '60%' },
    },
    xaxis: {
      categories: data.map((d) => d.name),
      labels: {
        style: { fontSize: '10px' },
        rotate,
        hideOverlappingLabels: hideOverlapping,
        trim: false,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: '11px' }, formatter: (v) => formatAxisTick(v) },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      y: { formatter: (v) => (knownNumber(v) === null ? '—' : Number(v).toLocaleString()) },
    },
  };
}

export function MetricBarChart({
  data,
  bars,
  height = 320,
  xLabelRotate,
  showAllXLabels,
}: MetricBarChartProps) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No chart data available</p>;
  }

  const series = bars.map((bar) => ({
    name: bar.label,
    data: data.map((row) => knownNumber(row[bar.key])),
  }));

  const chartHeight = data.length > 8 ? Math.max(height, 340) : height;

  return (
    <ApexChart
      type="bar"
      series={series}
      options={barOptions(data, bars, false, xLabelRotate, showAllXLabels)}
      height={chartHeight}
    />
  );
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
const UPTIME_IDLE_COLOR = '#d1d5db';

type UptimeStatus = 'up' | 'down' | 'idle' | 'offline';

function uptimeColor(status: UptimeStatus): string {
  switch (normalizeMachineStatus(status)) {
    case 'running':
      return UPTIME_UP_COLOR;
    case 'stopped':
      return UPTIME_DOWN_COLOR;
    case 'no_signal':
      return UPTIME_IDLE_COLOR;
  }
}

function uptimeChartLabel(status: UptimeStatus): string {
  return statusLabel(status);
}

export interface UptimeSegmentPoint {
  from: string;
  to: string;
  duration_seconds: number;
  status: UptimeStatus;
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

function formatAxisStart(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isLiveWindowEnd(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 120_000;
}

/** Nudge the open tail to the API window end when sub-second rounding left a gap. */
export function normalizeTimelineSegments(
  segments: UptimeSegmentPoint[],
  windowTo: string,
): UptimeSegmentPoint[] {
  if (segments.length === 0) return segments;
  const endMs = new Date(windowTo).getTime();
  const last = segments[segments.length - 1];
  const lastToMs = new Date(last.to).getTime();
  if (lastToMs >= endMs - 500 && lastToMs < endMs) {
    const fromMs = new Date(last.from).getTime();
    return [
      ...segments.slice(0, -1),
      { ...last, to: windowTo, duration_seconds: (endMs - fromMs) / 1000 },
    ];
  }
  return segments;
}

export interface SegmentDetail {
  label: string;
  value: string;
}

function UptimeSegmentTooltip({
  segment,
  details,
  ongoing,
}: {
  segment: UptimeSegmentPoint;
  details?: SegmentDetail[];
  ongoing?: boolean;
}) {
  return (
    <div className="pointer-events-none z-20 min-w-[240px] rounded-md border bg-white px-3 py-2.5 text-xs shadow-md">
      <p
        className="mb-2 font-semibold"
        style={{ color: uptimeColor(segment.status) }}
      >
        {uptimeChartLabel(segment.status)} · {formatDuration(segment.duration_seconds)}
        {ongoing ? ' · ongoing' : ''}
      </p>
      <dl className="space-y-1.5 text-muted">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide">From</dt>
          <dd className="font-mono text-[11px] text-foreground">{formatTimestamp(segment.from)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide">To</dt>
          <dd className="font-mono text-[11px] text-foreground">
            {ongoing ? 'Now (updates each refresh)' : formatTimestamp(segment.to)}
          </dd>
        </div>
        {(details ?? []).map((d) => (
          <div key={d.label}>
            <dt className="text-[10px] font-medium uppercase tracking-wide">{d.label}</dt>
            <dd className="text-[11px] text-foreground">{d.value}</dd>
          </div>
        ))}
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
  segmentDetails,
  powerCuts,
}: {
  segments: UptimeSegmentPoint[];
  windowFrom: string;
  windowTo: string;
  windowLabel?: string;
  height?: number;
  /** Extra tooltip rows per segment (e.g. downtime reason, active config). */
  segmentDetails?: (segment: UptimeSegmentPoint) => SegmentDetail[];
  /** Power cuts the board reported: marked even when too short to show as No signal. */
  powerCuts?: { from: string; to: string }[];
}) {
  // index: position among the drawn segments; last: the newest segment of the data.
  const [hover, setHover] = useState<{ segment: UptimeSegmentPoint; index: number; last: boolean } | null>(null);

  if (segments.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No uptime data available</p>;
  }

  const filled = normalizeTimelineSegments(segments, windowTo);
  const liveEnd = isLiveWindowEnd(windowTo);
  const axisStart = formatAxisStart(windowFrom);
  const axisEnd = liveEnd ? 'Now' : formatAxisStart(windowTo);

  // Each segment at its real time in the window (lib/timeline-layout.ts); time
  // without data stays empty. Absolute layout (left/width in %) avoids the
  // sub-pixel white seams a flex row of many thin segments produces.
  const placed = placeSegments(filled, windowFrom, windowTo);
  const cuts = placeMarks(powerCuts, windowFrom, windowTo);
  const cutTitle = (from: string, to: string) => {
    const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `Power cut: ${t(from)} – ${t(to)}`;
  };

  const hoverCenterPct = hover
    ? (placed[hover.index]?.leftPct ?? 0) + (placed[hover.index]?.widthPct ?? 0) / 2
    : 0;

  return (
    <div className="space-y-1">
      <div className="relative" style={{ contain: 'layout' }}>
        {cuts.map((c) => (
          // A red dot above the bar: visible on every colour, even on a stopped (red) loom.
          <span
            key={`dot-${c.from}`}
            className="absolute -top-1.5 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-white bg-red-600"
            style={{ left: `${c.leftPct + c.widthPct / 2}%` }}
            title={cutTitle(c.from, c.to)}
            aria-label={cutTitle(c.from, c.to)}
          />
        ))}
        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-20 mb-2"
            style={{ left: `${hoverCenterPct}%`, transform: 'translateX(-50%)' }}
          >
            <UptimeSegmentTooltip
              segment={hover.segment}
              ongoing={liveEnd && hover.last}
              details={segmentDetails?.(hover.segment)}
            />
          </div>
        )}
        <div
          className="relative w-full overflow-hidden rounded-md border border-slate-200"
          style={{ height, minHeight: height }}
          role="img"
          aria-label={`Machine status timeline for ${windowLabel ?? 'selected period'}`}
        >
          {placed.map(({ segment, index, leftPct, widthPct }, i) => {
            // Every segment overlaps its neighbors by ~1px on both sides so
            // no sub-pixel rounding gap between two adjacent boxes can ever
            // show the container background through — regardless of paint
            // order. Harmless at bar widths of hundreds of pixels.
            const leftPx = i === 0 ? 0 : 1;
            const extraWidthPx = (i === 0 ? 0 : 1) + (i === placed.length - 1 ? 0 : 1);
            return (
              <div
                key={`${segment.from}-${segment.to}-${segment.status}`}
                className="absolute top-0 bottom-0 hover:opacity-80"
                style={{
                  left: `calc(${leftPct}% - ${leftPx}px)`,
                  width: `calc(${widthPct}% + ${extraWidthPx}px)`,
                  minWidth: 1,
                  backgroundColor: uptimeColor(segment.status),
                }}
                onMouseEnter={() => setHover({ segment, index: i, last: index === filled.length - 1 })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
          {cuts.map((c) => (
            // The cut itself, at least 2 px wide: a second is far less than a pixel on 24 hours.
            <div
              key={`cut-${c.from}`}
              className="absolute top-0 bottom-0 z-10 bg-slate-900"
              style={{ left: `${c.leftPct}%`, width: `max(2px, ${c.widthPct}%)` }}
              title={cutTitle(c.from, c.to)}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 items-center text-[10px] text-muted tabular-nums">
        <span className="truncate pr-2">{axisStart}</span>
        <span className="truncate text-center">{windowLabel ?? 'selected period'}</span>
        <span className="truncate pl-2 text-right">{axisEnd}</span>
      </div>
    </div>
  );
}

interface UptimePoint {
  label: string;
  status: UptimeStatus;
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
  const colors = data.map((d) => uptimeColor(d.status));

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
        const color = uptimeColor(point.status);
        return `<div class="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
          <p class="font-medium">${point.label}</p>
          <p style="color:${color}">${uptimeChartLabel(point.status)}</p>
        </div>`;
      },
    },
  };

  return <ApexChart type="bar" series={series} options={options} height={height} />;
}
