'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Activity, Thermometer } from 'lucide-react';

import { ApexChart, baseChartOptions, type ApexOptions } from '@/components/charts/apex';
import { SplitCard } from '@/components/charts/donut-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { SummaryCard, type Tone } from '@/components/ui/simple';
import { PHONE_HIDDEN, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useLineName, useShown } from '@/lib/factory-refs-context';
import { formatDateTime, formatUpTo } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import {
  CLASS_LIMITS, KIND_UNIT, classInfo, classSlices, highestFirst, machineRows, summaryWords, trendLines,
} from '@/lib/sensor-figures';
import type { SensorKind } from '@/lib/types';
import { factoryMetricsApiRange, factoryScopeQueryKey, useFactoryDateRange } from '@/lib/use-factory-date-range';
import { useWideScreen } from '@/lib/use-wide-screen';
import { cn } from '@/lib/utils';
import { useFactoryHref } from '@/lib/factory-links-context';

const REFRESH_MS = 60_000;
const TONE_BADGE: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  idle: 'bg-slate-100 text-slate-600',
};

/**
 * Temperature or vibration for a factory: how its machines stand (the sentence and a pie of
 * bands / zones), the readings over the period (one line per machine, with the warning and alarm
 * levels) and each machine's figures. Sections can be switched off per factory (Pages & branding).
 */
export function SensorDashboard({ factoryId, kind }: { factoryId: string; kind: SensorKind }) {
  const link = useFactoryHref();
  const { t, tn, locale } = useT();
  const shown = useShown();
  const wide = useWideScreen();
  const lineName = useLineName();
  const { range, live, machineId, lineId } = useFactoryDateRange();
  const scopeKey = factoryScopeQueryKey({ machineId, lineId });
  const apiRange = factoryMetricsApiRange(range, { machineId, lineId });
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ['sensor-figures', kind, factoryId, live ? 'live' : range.from, live ? 'live' : range.to, ...scopeKey],
    queryFn: ({ signal }) => api.sensorFigures(factoryId, kind, apiRange, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  useSetRefreshInfo(dataUpdatedAt, REFRESH_MS / 1000);

  const unit = KIND_UNIT[kind];
  const value = (v: number | null) => (v === null ? '—' : `${formatUpTo(v, 1, locale)} ${unit}`);
  const summary = summaryWords(data, t, tn);
  const rows = useMemo(() => highestFirst(machineRows(data).filter((r) => r.status !== 'no_sensor')), [data]);
  const withoutSensor = data.machines.filter((m) => m.status === 'no_sensor').length;
  const temperature = kind === 'temperature';

  return (
    <div className="space-y-6">
      {shown(`${kind}.cards`) && (
        <>
          <SummaryCard
            tone={summary.tone}
            icon={summary.tone === 'good' ? undefined : temperature ? <Thermometer className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
            title={summary.title}
            subtitle={summary.subtitle}
          />
          {data.summary.with_sensor > 0 && (
            <SplitCard
              title={temperature ? t('Machines by temperature') : t('Machines by vibration zone')}
              description={temperature
                ? t('Now: normal up to {warn} °C, warm up to {bad} °C, hot above', CLASS_LIMITS.temperature)
                : t('Now, ISO 10816: good up to {warn} mm/s, warning up to {bad} mm/s, alarm above', CLASS_LIMITS.vibration)}
              slices={classSlices(data, t)}
              format={(n) => tn(n, '{count} machine', '{count} machines', { count: n })}
              centerLabel={t('Machines')}
              locale={locale}
            />
          )}
        </>
      )}

      {wide && shown(`${kind}.chart`) && rows.some((r) => r.status === 'ok') && (
        <SensorTrend kind={kind} lines={trendLines(data)} unit={unit} />
      )}

      {shown(`${kind}.table`) && (
        <Card>
          <CardHeader
            title={t('Machines')}
            description={withoutSensor > 0
              ? tn(withoutSensor, '{count} machine has no sensor of this kind', '{count} machines have no sensor of this kind', { count: withoutSensor })
              : undefined}
          />
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{t('No machine has a sensor of this kind yet.')}</p>
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>{t('Machine')}</TH>
                  <TH className={PHONE_HIDDEN}>{t('Line')}</TH>
                  <TH>{t('Now')}</TH>
                  <TH className={PHONE_HIDDEN}>{t('Lowest')}</TH>
                  <TH>{t('Highest')}</TH>
                  <TH className={PHONE_HIDDEN}>{t('Average')}</TH>
                  <TH className={PHONE_HIDDEN}>{t('Last reading')}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const info = classInfo(kind, r.cls);
                  return (
                    <TR key={r.machine_id}>
                      <TD>
                        <Link href={link(`/factories/${factoryId}/machines/${r.machine_id}`)} className="font-medium hover:underline">{r.machine_name}</Link>
                        {r.sensors > 1 && <span className="ml-1 text-xs text-muted">· {tn(r.sensors, '{count} sensor', '{count} sensors', { count: r.sensors })}</span>}
                      </TD>
                      <TD className={PHONE_HIDDEN}>{lineName(r.line_id)}</TD>
                      <TD>
                        <span className="tabular-nums">{value(r.value)}</span>
                        <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs font-medium', TONE_BADGE[info.tone])}>{t(info.word)}</span>
                      </TD>
                      <TD className={cn(PHONE_HIDDEN, 'tabular-nums')}>{value(r.min)}</TD>
                      <TD className="tabular-nums">{value(r.max)}</TD>
                      <TD className={cn(PHONE_HIDDEN, 'tabular-nums')}>{value(r.avg)}</TD>
                      <TD className={cn(PHONE_HIDDEN, 'text-xs text-muted')}>{r.latest_at ? formatDateTime(r.latest_at, locale) : '—'}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
          {data.unbound.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              {t('Readings from sensors not matched to a machine yet: {list}. Match them on Sensor mapping.', {
                list: data.unbound.map((u) => {
                  const f = u.figures.find((x) => x.latest !== null);
                  return `${u.name || u.slot}${f ? ` (${value(f.latest)})` : ''}`;
                }).join(', '),
              })}
              {' '}
              <Link href={link(`/factories/${factoryId}/sensor-mapping`)} className="font-medium underline">{t('Sensor mapping')}</Link>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

/** The readings over the period: one line per machine (its strongest sensor), with the warning and alarm levels. */
function SensorTrend({ kind, lines, unit }: { kind: SensorKind; lines: ReturnType<typeof trendLines>; unit: string }) {
  const { t, locale } = useT();
  const limits = CLASS_LIMITS[kind];
  const options = useMemo<ApexOptions>(() => ({
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'line' },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
    yaxis: { title: { text: unit, style: { fontWeight: 500 } }, labels: { formatter: (v: number) => formatUpTo(v, 1, locale) } },
    tooltip: { ...baseChartOptions.tooltip, x: { format: 'dd MMM HH:mm' }, y: { formatter: (v: number) => `${formatUpTo(v, 1, locale)} ${unit}` } },
    annotations: {
      yaxis: [
        { y: limits.warn, borderColor: '#f59e0b', strokeDashArray: 4, label: { text: kind === 'temperature' ? t('Warm') : t('Warning'), style: { color: '#92400e', background: '#fef3c7' } } },
        { y: limits.bad, borderColor: '#ef4444', strokeDashArray: 4, label: { text: kind === 'temperature' ? t('Hot') : t('Alarm'), style: { color: '#991b1b', background: '#fee2e2' } } },
      ],
    },
  }), [kind, limits, locale, t, unit]);
  return (
    <Card>
      <CardHeader
        title={kind === 'temperature' ? t('Temperature over the period') : t('Vibration over the period')}
        description={t('One line per machine, its highest sensor; the dashed lines are where the warning and alarm levels begin.')}
      />
      <ApexChart type="line" series={lines} options={options} height={320} />
    </Card>
  );
}
