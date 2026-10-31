'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Badge } from '@/components/ui/badge';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { LoadMore } from '@/components/ui/load-more';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { resolveListTotal } from '@/lib/pagination';
import { useInfiniteList } from '@/lib/use-infinite-list';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
import { formatDate } from '@/lib/utils';

/** A device is stale after this long without telemetry (sent with the request). */
const STALE_MINUTES = 15;

function deviceHref(factoryId: string, deviceId: string) {
  return `/internal/devices/${encodeURIComponent(factoryId)}/${encodeURIComponent(deviceId)}`;
}

function FleetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const factoryFilter = searchParams.get('factory_id') ?? '';
  const staleOnly = searchParams.get('stale') === '1';
  const deviceQ = searchParams.get('q') ?? '';

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });

  // Infinite scroll: the first devices, then more as the list's end comes into view.
  const { items: devices, total, hasMore, more, loading, query: devicesQuery } = useInfiniteList({
    queryKey: ['admin-devices', 'devices', factoryFilter, staleOnly, deviceQ],
    fetchPage: ({ limit, offset, signal }) =>
      api.adminDevices(
        {
          factory_id: factoryFilter || undefined,
          limit,
          offset,
          stale_minutes: STALE_MINUTES,
          stale_only: staleOnly ? '1' : undefined,
          q: deviceQ || undefined,
        },
        { signal },
      ).then((r) => ({
        items: r.devices ?? [],
        total: resolveListTotal(r.total, r.devices?.length ?? 0, limit, offset),
      })),
  });

  function setQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (
      patch.factory_id !== undefined ||
      patch.stale !== undefined ||
      patch.q !== undefined
    ) {
      next.delete('page');
    }
    router.replace(`/internal/devices?${next.toString()}`);
  }

  async function fetchAllDevices() {
    const all = await fetchAllPages(({ limit, offset }) =>
      api
        .adminDevices({
          factory_id: factoryFilter || undefined,
          limit,
          offset,
          stale_minutes: STALE_MINUTES,
          stale_only: staleOnly ? '1' : undefined,
          q: deviceQ || undefined,
        })
        .then((r) => ({ items: r.devices, total: r.total })),
    );
    return all.map((d) => [
      d.device_id,
      d.factory_id,
      d.line_id,
      d.device_type,
      d.last_seen_at ?? '',
      d.is_stale ? 'stale' : 'ok',
    ]);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="Fleet"
          description={`Stale if no telemetry for ${STALE_MINUTES} minutes`}
          action={
            <ExportCsvButton
              filename="device-fleet"
              headers={['Device', 'Factory', 'Line', 'Type', 'Last seen', 'Status']}
              fetchRows={fetchAllDevices}
              rowCount={total}
            />
          }
        />

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Factory">
            <Select
              className="min-w-[12rem]"
              value={factoryFilter}
              onChange={(e) => setQuery({ factory_id: e.target.value || null })}
            >
              <option value="">All factories</option>
              {(factoriesQuery.data?.factories ?? []).map((f) => (
                <option key={f.factory_id} value={f.factory_id}>
                  {f.name ?? f.factory_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Device id contains">
            <Input
              className="min-w-[12rem]"
              value={deviceQ}
              placeholder="esp-node-…"
              onChange={(e) => setQuery({ q: e.target.value || null })}
            />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={staleOnly}
              onChange={(e) => setQuery({ stale: e.target.checked ? '1' : null })}
            />
            Stale only
          </label>
        </div>

        {devicesQuery.isError ? (
          <p className="text-sm text-red-600">{(devicesQuery.error as Error).message}</p>
        ) : queryShowsTableLoading(devicesQuery) ? (
          <TableSkeleton rows={8} cols={6} />
        ) : devices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No devices match filters.</p>
        ) : (
          <>
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Device</TH>
                  <TH>Factory</TH>
                  <TH>Line</TH>
                  <TH>Type</TH>
                  <TH>Last seen</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {devices.map((d) => (
                  <TR key={`${d.factory_id}:${d.device_id}`}>
                    <TD>
                      <Link
                        href={deviceHref(d.factory_id, d.device_id)}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {d.device_id}
                      </Link>
                    </TD>
                    <TD>
                      <Link href={`/factories/${d.factory_id}`} className="text-sm hover:underline">
                        {d.factory_id}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs">{d.line_id}</TD>
                    <TD>{d.device_type}</TD>
                    <TD>{d.last_seen_at ? formatDate(d.last_seen_at) : '—'}</TD>
                    <TD>
                      <Badge className={d.is_stale ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}>
                        {d.is_stale ? 'Stale' : 'OK'}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <LoadMore shown={devices.length} total={total} hasMore={hasMore} onMore={more} loading={loading} />
          </>
        )}
      </Card>
    </div>
  );
}

export function DevicesFleetPanel() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
      <FleetInner />
    </Suspense>
  );
}
