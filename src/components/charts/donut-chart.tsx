'use client';

import { useMemo } from 'react';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { Card, CardHeader } from '@/components/ui/card';
import { useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { useWideScreen } from '@/lib/use-wide-screen';
import { cn, formatNumber } from '@/lib/utils';

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
 * The chart's options for the slices drawn: a thin ring with the total in its middle; a hovered
 * slice shows its own label and figure there instead (no floating tooltip, so nothing is ever
 * white on a light slice), and darkens a little (ApexCharts would lighten it: the grey "no data"
 * slice turned white against the white card).
 */
export function donutChartOptions(
  drawn: Slice[],
  centerFormat: (value: number) => string,
  centerLabel: string,
): ApexOptions {
  return {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'donut' },
    labels: drawn.map((s) => s.label),
    colors: drawn.map((s) => s.color),
    legend: { show: false },
    stroke: { width: 3, colors: ['#fff'] },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '78%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', fontWeight: 500, color: '#64748b', offsetY: 22 },
            value: { show: true, fontSize: '24px', fontWeight: 700, color: '#0f172a', offsetY: -12, formatter: (v: string) => centerFormat(Number(v)) },
            total: {
              show: true,
              showAlways: false,
              label: centerLabel,
              fontSize: '12px',
              fontWeight: 500,
              color: '#64748b',
              formatter: (w: { globals: { seriesTotals: number[] } }) => centerFormat(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
            },
          },
        },
      },
    },
    states: {
      hover: { filter: { type: 'darken' } },
      active: { filter: { type: 'darken' } },
    },
    tooltip: { enabled: false },
  };
}

/**
 * A donut with its legend: the chart on wide screens, the legend (label, figure, share and a
 * bar for it) always, so a phone gets the figures without the chart. Slices of 0 stay in the
 * legend and are left out of the ring. `format` writes a slice's figure ("3 machines"); the
 * middle of the ring shows `centerFormat` of the total under `centerLabel`.
 */
export function DonutChart({ slices, format, centerFormat, centerLabel, height = 230, locale, className }: {
  slices: Slice[];
  format?: (value: number) => string;
  centerFormat?: (value: number) => string;
  centerLabel?: string;
  height?: number;
  locale?: Locale;
  className?: string;
}) {
  const { t } = useT();
  const wide = useWideScreen();
  const shares = sliceShares(slices);
  const drawn = slices.filter((s) => s.value > 0);
  const figure = useMemo(() => format ?? ((v: number) => formatNumber(v, 0, locale)), [format, locale]);
  const middle = useMemo(() => centerFormat ?? ((v: number) => formatNumber(v, 0, locale)), [centerFormat, locale]);
  const caption = centerLabel ?? t('Total');
  const options = useMemo<ApexOptions>(() => donutChartOptions(drawn, middle, caption), [drawn, middle, caption]);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

  return (
    <div className={cn('flex flex-col items-stretch gap-6 sm:flex-row sm:items-center', className)}>
      {wide && drawn.length > 0 && (
        <div className="mx-auto w-full max-w-[15rem] shrink-0 sm:mx-0">
          <ApexChart type="donut" series={drawn.map((s) => s.value)} options={options} height={height} />
        </div>
      )}
      <ul className="min-w-0 flex-1 space-y-3 text-sm" data-testid="donut-legend">
        {slices.map((s, i) => (
          <li key={s.label} className={cn(s.value <= 0 && 'opacity-60')}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate text-foreground">{s.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-foreground">{figure(s.value)}</span>
                <span className="ml-2 inline-block w-9 text-right text-xs text-muted">{total > 0 ? `${formatNumber(shares[i], 0, locale)}%` : '—'}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${shares[i]}%`, background: s.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A donut in its own tile: a title, what it shows, the chart and legend. */
export function SplitCard({ title, description, slices, format, centerFormat, centerLabel, locale, empty }: {
  title: string;
  description?: string;
  slices: Slice[];
  format?: (value: number) => string;
  centerFormat?: (value: number) => string;
  centerLabel?: string;
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
        : <DonutChart slices={slices} format={format} centerFormat={centerFormat} centerLabel={centerLabel} locale={locale} />}
    </Card>
  );
}
