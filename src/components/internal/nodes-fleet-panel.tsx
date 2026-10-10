'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { AddNodeModal } from '@/components/internal/add-node-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { isInternalAdmin } from '@/lib/internal-auth';
import { useAuth } from '@/lib/auth-context';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
import { formatDate } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/page-skeletons';

function nodeHref(factoryId: string, deviceId: string, tab?: 'sensors') {
  const base = `/internal/devices/${encodeURIComponent(factoryId)}/${encodeURIComponent(deviceId)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

function NodesFleetInner() {
  const { user } = useAuth();
  const canWrite = isInternalAdmin(user);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pagination = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  const factoryFilter = searchParams.get('factory_id') ?? '';
  const lineFilter = searchParams.get('line_id') ?? '';
  const machineFilter = searchParams.get('machine_id') ?? '';
  const statusFilter =
    searchParams.get('status') ??
    (searchParams.get('stale') === '1' ? 'stale' : '');
  const deviceQ = searchParams.get('q') ?? '';

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });

  const linesQuery = useQuery({
    queryKey: ['factory-lines', factoryFilter],
    enabled: Boolean(factoryFilter),
    queryFn: ({ signal }) => api.lines(factoryFilter, { limit: 200, offset: 0 }, { signal }),
  });

  const machinesQuery = useQuery({
    queryKey: ['factory-machines', factoryFilter, lineFilter],
    enabled: Boolean(factoryFilter),
    queryFn: ({ signal }) =>
      api.machines(factoryFilter, lineFilter ? { line_id: lineFilter } : undefined, { signal }),
  });

  const machinesForSelect = useMemo(() => {
    const list = machinesQuery.data?.machines ?? [];
    if (!lineFilter) return list;
    return list.filter((m) => m.line_id === lineFilter);
  }, [machinesQuery.data?.machines, lineFilter]);

  const nodesQuery = useQuery({
    queryKey: [
      'admin-devices',
      factoryFilter,
      lineFilter,
      machineFilter,
      statusFilter,
      deviceQ,
      pagination.page,
      pagination.limit,
    ],
    queryFn: ({ signal }) =>
      api.adminDevices(
        {
          factory_id: factoryFilter || undefined,
          line_id: lineFilter || undefined,
          machine_id: machineFilter || undefined,
          limit: pagination.limit,
          offset: pagination.offset,
          stale_minutes: 15,
          stale_only: statusFilter === 'stale' ? '1' : undefined,
          fresh_only: statusFilter === 'ok' ? '1' : undefined,
          q: deviceQ || undefined,
        },
        { signal },
      ),
  });

  const nodes = nodesQuery.data?.devices ?? [];

  const total = resolveListTotal(
    nodesQuery.data?.total,
    nodes.length,
    pagination.limit,
    pagination.offset,
  );

  function setQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (patch.factory_id !== undefined) {
      next.delete('line_id');
      next.delete('machine_id');
      next.delete('page');
    } else if (patch.line_id !== undefined) {
      next.delete('machine_id');
      next.delete('page');
    } else if (
      patch.machine_id !== undefined ||
      patch.status !== undefined ||
      patch.stale !== undefined ||
      patch.q !== undefined
    ) {
      if (patch.status !== undefined) next.delete('stale');
      next.delete('page');
    }
    router.replace(`/internal/nodes?${next.toString()}`);
  }

  async function fetchAllNodes() {
    const all = await fetchAllPages(({ limit, offset }) =>
      api
        .adminDevices({
          factory_id: factoryFilter || undefined,
          line_id: lineFilter || undefined,
          machine_id: machineFilter || undefined,
          limit,
          offset,
          stale_minutes: 15,
          stale_only: statusFilter === 'stale' ? '1' : undefined,
          fresh_only: statusFilter === 'ok' ? '1' : undefined,
          q: deviceQ || undefined,
        })
        .then((r) => ({ items: r.devices, total: r.total })),
    );
    return all.map((d) => [
      d.device_id,
      d.factory_id,
      d.line_id,
      (d.machines ?? []).map((m) => m.machine_id).join('; ') || '—',
      d.device_type,
      d.last_seen_at ?? '',
      d.is_stale ? 'stale' : 'ok',
    ]);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="All nodes"
          description="ESP32 fleet — filter by factory, line, machine, or heartbeat status (15m threshold)"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <Button size="sm" onClick={() => setAddNodeOpen(true)}>
                  Register node
                </Button>
              )}
              <ExportCsvButton
                filename="esp-nodes"
                headers={['Node', 'Factory', 'Line', 'Machine(s)', 'Type', 'Last seen', 'Status']}
                fetchRows={fetchAllNodes}
                rowCount={total}
              />
            </div>
          }
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Factory">
            <Select
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
          <Field label="Line">
            <Select
              value={lineFilter}
              disabled={!factoryFilter}
              onChange={(e) => setQuery({ line_id: e.target.value || null })}
            >
              <option value="">{factoryFilter ? 'All lines' : 'Select factory first'}</option>
              {(linesQuery.data?.lines ?? []).map((l) => (
                <option key={l.line_id} value={l.line_id}>
                  {l.name ?? l.line_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Machine">
            <Select
              value={machineFilter}
              disabled={!factoryFilter}
              onChange={(e) => setQuery({ machine_id: e.target.value || null })}
            >
              <option value="">{factoryFilter ? 'All machines' : 'Select factory first'}</option>
              {machinesForSelect.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.name ?? m.machine_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Node id contains">
            <Input
              value={deviceQ}
              placeholder="node-…"
              onChange={(e) => setQuery({ q: e.target.value || null })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => setQuery({ status: e.target.value || null })}
            >
              <option value="">All</option>
              <option value="ok">OK (seen in last 15m)</option>
              <option value="stale">Stale</option>
            </Select>
          </Field>
        </div>

        {nodesQuery.isError ? (
          <p className="text-sm text-red-600">{(nodesQuery.error as Error).message}</p>
        ) : queryShowsTableLoading(nodesQuery) ? (
          <TableSkeleton rows={8} cols={8} />
        ) : nodes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No nodes match filters.</p>
        ) : (
          <>
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Node</TH>
                  <TH>Factory</TH>
                  <TH>Line</TH>
                  <TH>Machine(s)</TH>
                  <TH>Type</TH>
                  <TH>Last seen</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {nodes.map((d) => (
                  <TR key={`${d.factory_id}:${d.device_id}`}>
                    <TD>
                      <Link
                        href={nodeHref(d.factory_id, d.device_id)}
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
                    <TD>
                      {(d.machines ?? []).length === 0 ? (
                        <span className="text-xs text-muted">Unlinked</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(d.machines ?? []).map((m) => (
                            <Link
                              key={m.machine_id}
                              href={`/factories/${d.factory_id}/machines/${m.machine_id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {m.name ?? m.machine_id}
                            </Link>
                          ))}
                        </div>
                      )}
                    </TD>
                    <TD>{d.device_type}</TD>
                    <TD>{d.last_seen_at ? formatDate(d.last_seen_at) : '—'}</TD>
                    <TD>
                      <Badge
                        className={
                          d.is_stale ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                        }
                      >
                        {d.is_stale ? 'Stale' : 'OK'}
                      </Badge>
                    </TD>
                    <TD>
                      <Link
                        href={nodeHref(d.factory_id, d.device_id, 'sensors')}
                        className="text-xs text-primary hover:underline"
                      >
                        Sensors
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination total={total} page={pagination.page} limit={pagination.limit} />
          </>
        )}
      </Card>

      <AddNodeModal
        open={addNodeOpen}
        onClose={() => setAddNodeOpen(false)}
        defaultFactoryId={factoryFilter || undefined}
      />
    </div>
  );
}

export function NodesFleetPanel() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={8} />}>
      <NodesFleetInner />
    </Suspense>
  );
}
