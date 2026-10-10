'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { NodeSensorBindingsEditor } from '@/components/sensors/node-sensor-bindings-editor';
import { isInternalAdmin } from '@/lib/internal-auth';
import { useAuth } from '@/lib/auth-context';
import { StatGridSkeleton, TableSkeleton } from '@/components/ui/page-skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

function capitalizeKind(kind: string) {
  const base = kind.split(' ')[0] ?? kind;
  const rest = kind.slice(base.length);
  return base.charAt(0).toUpperCase() + base.slice(1) + rest;
}

type Tab = 'overview' | 'sensors' | 'health' | 'readings';

function DetailInner({ factoryId, deviceId }: { factoryId: string; deviceId: string }) {
  const { user } = useAuth();
  const canEditBindings = isInternalAdmin(user);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    initialTab === 'sensors' || initialTab === 'health' || initialTab === 'readings'
      ? initialTab
      : 'overview',
  );

  const range = resolveDateRange(
    { from: searchParams.get('from') ?? undefined, to: searchParams.get('to') ?? undefined },
    null,
  );
  const rangeLabel = formatRangeLabel(range.from, range.to);

  const recentQuery = useQuery({
    queryKey: ['readings-recent', factoryId, deviceId],
    queryFn: ({ signal }) =>
      api.readingsRecent(factoryId, { device_id: deviceId, limit: 5 }, { signal }),
  });

  const rangeQuery = useQuery({
    queryKey: ['readings-range', factoryId, deviceId, range.from, range.to],
    enabled: tab === 'readings',
    queryFn: ({ signal }) =>
      api.readingsRange(
        factoryId,
        { device_id: deviceId, from: range.from, to: range.to, limit: 2000 },
        { signal },
      ),
  });

  const deviceMeta = recentQuery.data?.devices?.[0];
  const latestCurrent = deviceMeta?.current?.[0];
  const latestCycle = deviceMeta?.cycle?.[0];

  const readingRows = useMemo(() => {
    if (!rangeQuery.data) return [];
    const rows: Array<{ at: string; kind: string; summary: string }> = [];
    for (const c of rangeQuery.data.current ?? []) {
      const slot = (c.metadata?.slot as string | undefined) ?? (c.metadata?.name as string | undefined);
      rows.push({
        at: c.occurred_at,
        kind: slot ? `current (${slot})` : 'current',
        summary: `state=${c.state ?? '—'} amps=${c.amps ?? '—'} (${c.amps_min ?? '—'}–${c.amps_max ?? '—'})`,
      });
    }
    for (const c of rangeQuery.data.cycle ?? []) {
      const slot = (c.metadata?.slot as string | undefined) ?? (c.metadata?.name as string | undefined);
      rows.push({
        at: c.occurred_at,
        kind: slot ? `cycle (${slot})` : 'cycle',
        summary: `count=${c.count} running=${c.running ?? '—'} window_s=${c.window_s ?? '—'}`,
      });
    }
    return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [rangeQuery.data]);

  async function exportReadingsCsv() {
    return readingRows.map((r) => [r.at, r.kind, r.summary]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sensors', label: 'Sensors' },
    { id: 'health', label: 'Health' },
    { id: 'readings', label: 'Readings' },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-primary text-white' : 'text-muted hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card className="p-6">
          <CardHeader title={deviceId} description={`Factory ${factoryId}`} />
          {recentQuery.isLoading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-5 w-32" />
                </div>
              ))}
            </div>
          ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Factory</dt>
              <dd>
                <Link href={`/factories/${factoryId}`} className="font-medium text-primary hover:underline">
                  {factoryId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Line</dt>
              <dd className="font-mono">{deviceMeta?.line_id ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Type</dt>
              <dd>{deviceMeta?.device_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Last seen</dt>
              <dd>{deviceMeta?.last_seen_at ? formatDate(deviceMeta.last_seen_at) : '—'}</dd>
            </div>
          </dl>
          )}
        </Card>
      )}

      {tab === 'sensors' && (
        <NodeSensorBindingsEditor
          factoryId={factoryId}
          deviceId={deviceId}
          apiMode="admin"
          canWrite={canEditBindings}
        />
      )}

      {tab === 'health' && (
        <Card className="p-6">
          <CardHeader title="Health snapshot" description="Latest telemetry samples (not aggregated metrics)" />
          {recentQuery.isLoading ? (
            <div className="mt-4 space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-medium">Last seen</p>
                <p className="text-muted">
                  {deviceMeta?.last_seen_at ? formatDate(deviceMeta.last_seen_at) : 'No heartbeat recorded'}
                </p>
              </div>
              <div>
                <p className="font-medium">Latest current sample</p>
                {latestCurrent ? (
                  <p className="font-mono text-xs">
                    {formatDate(latestCurrent.occurred_at)} · {latestCurrent.state} · {latestCurrent.amps}
                  </p>
                ) : (
                  <p className="text-muted">None in recent window</p>
                )}
              </div>
              <div>
                <p className="font-medium">Latest cycle sample</p>
                {latestCycle ? (
                  <p className="font-mono text-xs">
                    {formatDate(latestCycle.occurred_at)} · count={latestCycle.count}
                  </p>
                ) : (
                  <p className="text-muted">None in recent window</p>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'readings' && (
        <Card className="p-6">
          <CardHeader
            title="Raw readings"
            description={rangeLabel}
            action={
              <ExportCsvButton
                filename={`readings-${deviceId}`}
                headers={['Occurred at', 'Kind', 'Summary']}
                fetchRows={exportReadingsCsv}
                rowCount={readingRows.length}
                disabled={readingRows.length === 0}
              />
            }
          />
          <div className="mb-4">
            <DateRangeToolbar from={searchParams.get('from') ?? undefined} to={searchParams.get('to') ?? undefined} />
          </div>
          {rangeQuery.isLoading ? (
            <TableSkeleton rows={8} cols={3} />
          ) : rangeQuery.isError ? (
            <p className="text-sm text-red-600">{(rangeQuery.error as Error).message}</p>
          ) : readingRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No readings in this range.</p>
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Kind</TH>
                  <TH>Payload</TH>
                </TR>
              </THead>
              <TBody>
                {readingRows.map((r, i) => (
                  <TR key={`${r.at}-${r.kind}-${i}`}>
                    <TD className="whitespace-nowrap text-xs">{formatDate(r.at)}</TD>
                    <TD>
                      <Badge className="bg-slate-100 text-slate-700">{capitalizeKind(r.kind)}</Badge>
                    </TD>
                    <TD className="font-mono text-xs">{r.summary}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

function DeviceDetailFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-9 w-72" />
      <StatGridSkeleton count={2} />
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}

export function DeviceDetailPanel({ factoryId, deviceId }: { factoryId: string; deviceId: string }) {
  return (
    <Suspense fallback={<DeviceDetailFallback />}>
      <DetailInner factoryId={factoryId} deviceId={deviceId} />
    </Suspense>
  );
}
