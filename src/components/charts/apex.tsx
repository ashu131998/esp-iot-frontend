'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

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
  type: 'bar' | 'line' | 'area';
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
  },
  grid: {
    borderColor: '#e2e8f0',
    strokeDashArray: 3,
    padding: { left: 8, right: 8, top: 0, bottom: 0 },
  },
  dataLabels: { enabled: false },
  legend: {
    show: true,
    position: 'bottom',
    fontSize: '12px',
    markers: { size: 6 },
    itemMargin: { horizontal: 8, vertical: 4 },
  },
  tooltip: { theme: 'light', style: { fontSize: '12px' } },
};

/** Compact axis tick formatter (mirrors the old recharts formatChartAxisTick). */
export function formatAxisTick(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
