'use client';

import { useMemo } from 'react';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/locale';
import { useT } from '@/lib/i18n/context';
import { useWideScreen } from '@/lib/use-wide-screen';
import { cn } from '@/lib/utils';

/** One slice of a pie: its label (already translated), its size and its colour. */
export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Slice colours by tone, the same greens / ambers / reds as the status badges. */
export const SLICE_COLORS = {
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
  idle: '#d1d5db',
  /** For splits with no good or bad, e.g. energy by line: blue, violet, sky, pink, teal, orange… */
  series: ['#3b82f6', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#6366f1'],
} as const;

/** Each slice's share of the whole, in percent (0 when the whole is 0). */
export function sliceShares(slices: Slice[]): number[] {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  return slices.map((x) => (total > 0 ? (100 * Math.max(0, x.value)) / total : 0));
}

/**
 * The chart's options for the slices drawn. A hovered slice darkens a little (ApexCharts would
 * lighten it, which turns the grey "no data" slice white against the white card), and the
 * tooltip is always a white box with dark text (never the slice's own colour with white text:
 * unreadable on grey or amber).
 */
export function donutChartOptions(drawn: Slice[], format: (value: number) => string): ApexOptions {
  return {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'donut' },
    labels: drawn.map((s) => s.label),
    colors: drawn.map((s) => s.color),
    legend: { show: false },
    stroke: { width: 2, colors: ['#fff'] },
    plotOptions: { pie: { donut: { size: '68%' }, expandOnClick: false } },
    dataLabels: { enabled: false },
    states: {
      hover: { filter: { type: 'darken' } },
      active: { filter: { type: 'darken' } },
    },
    tooltip: {
      ...baseChartOptions.tooltip,
      theme: 'light',
      fillSeriesColor: false,
      y: { formatter: format },
    },
  };
}

/**
 * A donut with its legend: the chart on wide screens, the legend (label, figure, share) always,
 * so a phone gets the figures without the chart. Slices of 0 are kept in the legend, left out of
 * the chart. `format` writes a slice's figure ("3 machines", "12.4 kWh").
 */
export function DonutChart({ slices, format, height = 220, locale, className }: {
  slices: Slice[];
  format?: (value: number) => string;
  height?: number;
  locale?: Locale;
  className?: string;
}) {
  const wide = useWideScreen();
  const shares = sliceShares(slices);
  const drawn = slices.filter((s) => s.value > 0);
  const options = useMemo<ApexOptions>(() => donutChartOptions(drawn, (v) => (format ? format(v) : formatNumber(v, 1, locale))), [drawn, format, locale]);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

  return (
    <div className={cn('flex flex-col items-stretch gap-4 sm:flex-row sm:items-center', className)}>
      {wide && drawn.length > 0 && (
        <div className="sm:w-1/2">
          <ApexChart type="donut" series={drawn.map((s) => s.value)} options={options} height={height} />
        </div>
      )}
      <ul className="flex-1 space-y-2 text-sm" data-testid="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium">{format ? format(s.value) : formatNumber(s.value, 0, locale)}</span>
              <span className="ml-2 text-xs text-muted">{total > 0 ? `${formatNumber(shares[i], 0, locale)}%` : '—'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A donut in its own card: a title, what it shows, the chart and legend. */
export function SplitCard({ title, description, slices, format, locale, empty }: {
  title: string;
  description?: string;
  slices: Slice[];
  format?: (value: number) => string;
  locale?: Locale;
  /** What to say when every slice is 0. */
  empty?: string;
}) {
  const { t } = useT();
  const nothing = slices.every((s) => s.value <= 0);
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {nothing
        ? <p className="text-sm text-muted">{empty ?? t('Nothing to show yet')}</p>
        : <DonutChart slices={slices} format={format} locale={locale} />}
    </Card>
  );
}
