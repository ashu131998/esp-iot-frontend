'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

import { formatCompact, formatUpTo } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locale';

// ApexCharts references `window` at import time, so it must never run during SSR.
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => null,
});

export type { ApexOptions };

export function ApexChart({
  type,
  series,
  options,
  height = 320,
  width = '100%',
}: {
  type: 'bar' | 'line' | 'area' | 'donut';
  series: ApexOptions['series'];
  options: ApexOptions;
  height?: number;
  width?: number | string;
}) {
  return (
    <div style={{ minHeight: height }}>
      <ReactApexChart type={type} series={series} options={options} height={height} width={width} />
    </div>
  );
}

/** Shared base styling so every chart matches the old recharts look. */
export const baseChartOptions: ApexOptions = {
  chart: {
    fontFamily: 'inherit',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 300 },
    parentHeightOffset: 0,
    foreColor: '#64748b',
  },
  grid: {
    borderColor: '#f1f5f9',
    strokeDashArray: 4,
    padding: { left: 8, right: 8, top: 0, bottom: 0 },
  },
  dataLabels: { enabled: false },
  legend: {
    show: true,
    position: 'bottom',
    fontSize: '12px',
    markers: { size: 5, shape: 'circle' },
    itemMargin: { horizontal: 8, vertical: 4 },
  },
  tooltip: { theme: 'light', style: { fontSize: '12px' } },
};

/** Compact axis tick: 1200 → "1.2K", 123456 → "1.2L" (Hindi: "1.2 लाख"), 42.25 → "42.3". */
export function formatAxisTick(value: number, locale: Locale = 'en'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1000) return formatCompact(n, locale);
  return formatUpTo(n, 1, locale);
}
