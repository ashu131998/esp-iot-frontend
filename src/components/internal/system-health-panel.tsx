'use client';

import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
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
            Set <code className="text-xs">INTERNAL_REQUIRE_CF_ACCESS=true</code> on the frontend when Cloudflare
            Access protects staff URLs.
          </li>
          <li>Point staff at an <code className="text-xs">internal.</code> hostname behind Access; disable public dev URLs.</li>
        </ul>
      </Card>
    </div>
  );
}
