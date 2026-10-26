'use client';

import { useQuery } from '@tanstack/react-query';

import { StatusBadge } from '@/components/internal/board-status-cells';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
import { formatBytes } from '@/lib/board-status';
import { capacityVerdict, fullInLabel, growthLabel, machinesLabel } from '@/lib/capacity';
import { formatDate } from '@/lib/utils';

export function SystemHealthPanel() {
  const healthQuery = useQuery({
    queryKey: ['admin-health'],
    queryFn: ({ signal }) => api.adminHealth(undefined, { signal }),
    refetchInterval: 60_000,
  });

  const data = healthQuery.data;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="Platform health"
          description={
            data?.checked_at ? `Last checked ${formatDate(data.checked_at)}` : 'Query API and fleet signals'
          }
        />
        {queryShowsTableLoading(healthQuery) ? (
          <div className="mt-4">
            <StatGridSkeleton count={3} />
          </div>
        ) : healthQuery.isError ? (
          <p className="mt-4 text-sm text-red-600">{(healthQuery.error as Error).message}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted">Postgres</p>
              <Badge className={data?.postgres === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                {data?.postgres ?? 'unknown'}
              </Badge>
            </div>
            {data?.summary && (
              <>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted">Devices</p>
                  <p className="text-xl font-semibold">{data.summary.device_count}</p>
                  <p className="text-xs text-muted">
                    {data.summary.device_stale_count} stale (&gt;{data.summary.stale_threshold_minutes}m)
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted">Factories</p>
                  <p className="text-xl font-semibold">{data.summary.factory_count}</p>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Capacity"
          description="The server's disk, how fast it fills, and the machines it carries (hourly samples)"
          action={data?.capacity ? <StatusBadge cell={capacityVerdict(data.capacity)} /> : undefined}
        />
        {!data?.capacity ? (
          <p className="mt-4 text-sm text-muted">Not known yet (the server samples its disk every hour).</p>
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span>Disk {data.capacity.disk.used_pct} % used</span>
                <span className="text-muted">
                  {formatBytes(data.capacity.disk.used)} of {formatBytes(data.capacity.disk.total)} · {formatBytes(data.capacity.disk.free)} free
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-100">
                <div
                  className={`h-2 rounded ${data.capacity.disk.used_pct >= 85 ? 'bg-red-500' : data.capacity.disk.used_pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, data.capacity.disk.used_pct)}%` }}
                />
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted">Growth</dt>
                <dd className="font-semibold">{growthLabel(data.capacity)}</dd>
              </div>
              <div>
                <dt className="text-muted">Full in</dt>
                <dd className="font-semibold">{fullInLabel(data.capacity)}</dd>
              </div>
              <div>
                <dt className="text-muted">Database</dt>
                <dd className="font-semibold">{data.capacity.db_bytes !== null ? formatBytes(data.capacity.db_bytes) : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Machines</dt>
                <dd className="font-semibold">{machinesLabel(data.capacity)}</dd>
              </div>
            </dl>
          </>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="Aggregator" description="Shift aggregation service (singleton row in Postgres)" />
        {!data?.aggregator ? (
          <p className="mt-4 text-sm text-muted">No aggregator heartbeat row yet.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Pending failures</dt>
              <dd className="font-semibold">{data.aggregator.pending_failures ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted">Last pass</dt>
              <dd>{data.aggregator.last_pass_at ? formatDate(data.aggregator.last_pass_at) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Failures since</dt>
              <dd>{data.aggregator.failures_since ? formatDate(data.aggregator.failures_since) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Updated</dt>
              <dd>{data.aggregator.updated_at ? formatDate(data.aggregator.updated_at) : '—'}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="p-6 text-sm text-muted">
        <CardHeader title="Edge access" description="Production hardening (ops)" />
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Set <code className="text-xs">INTERNAL_STAFF_HOSTNAMES</code> on the Worker so{' '}
            <code className="text-xs">/internal</code> is not served on public{' '}
            <code className="text-xs">*.workers.dev</code> URLs.
          </li>
          <li>
            Set <code className="text-xs">INTERNAL_REQUIRE_CF_ACCESS=true</code> when Cloudflare Access protects
            the staff hostname.
          </li>
        </ul>
      </Card>
    </div>
  );
}
