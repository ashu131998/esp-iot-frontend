'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { TablePagination } from '@/components/ui/table-pagination';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';
import { queryShowsTableLoading } from '@/lib/query-table-loading';
import { formatDate } from '@/lib/utils';

export type AuditEntry = {
  id: number;
  occurred_at: string;
  actor_user_id: string;
  actor_username: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
};

function formatAuditDetails(details: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return '—';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') {
      parts.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      parts.push(`${k}: ${String(v)}`);
    }
  }
  return parts.join(' · ') || '—';
}

function AuditInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pagination = resolvePagination({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  const actionFilter = searchParams.get('action') ?? '';
  const actorFilter = searchParams.get('actor') ?? '';
  const fromFilter = searchParams.get('from') ?? '';
  const toFilter = searchParams.get('to') ?? '';

  const auditQuery = useQuery({
    queryKey: [
      'admin-audit',
      pagination.page,
      pagination.limit,
      actionFilter,
      actorFilter,
      fromFilter,
      toFilter,
    ],
    queryFn: ({ signal }) =>
      api.adminAudit(
        {
          limit: pagination.limit,
          offset: pagination.offset,
          action: actionFilter || undefined,
          actor: actorFilter || undefined,
          from: fromFilter || undefined,
          to: toFilter || undefined,
        },
        { signal },
      ),
  });

  const entries = (auditQuery.data?.entries ?? []) as AuditEntry[];
  const total = resolveListTotal(
    auditQuery.data?.total,
    entries.length,
    pagination.limit,
    pagination.offset,
  );

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    next.delete('page');
    router.replace(`/internal/audit?${next.toString()}`);
  }

  async function fetchAllAudit() {
    const all = await fetchAllPages(({ limit, offset }) =>
      api
        .adminAudit({
          limit,
          offset,
          action: actionFilter || undefined,
          actor: actorFilter || undefined,
          from: fromFilter || undefined,
          to: toFilter || undefined,
        })
        .then((r) => ({ items: r.entries as AuditEntry[], total: r.total })),
    );
    return all.map((e) => [
      e.occurred_at,
      e.actor_username ?? e.actor_user_id,
      e.action,
      e.target_type ?? '',
      e.target_id ?? '',
      formatAuditDetails(e.details ?? {}),
    ]);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="Audit trail"
          description="Admin and owner mutations on the platform"
          action={
            <ExportCsvButton
              filename="audit-log"
              headers={['Time', 'Actor', 'Action', 'Target type', 'Target id', 'Details']}
              fetchRows={fetchAllAudit}
              rowCount={total}
            />
          }
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Action (exact)">
            <Input
              placeholder="factory.onboard"
              value={actionFilter}
              onChange={(e) => setFilter('action', e.target.value)}
            />
          </Field>
          <Field label="Actor contains">
            <Input
              placeholder="username"
              value={actorFilter}
              onChange={(e) => setFilter('actor', e.target.value)}
            />
          </Field>
          <Field label="From (ISO)">
            <Input
              placeholder="2026-01-01"
              value={fromFilter}
              onChange={(e) => setFilter('from', e.target.value)}
            />
          </Field>
          <Field label="To (ISO)">
            <Input
              placeholder="2026-12-31"
              value={toFilter}
              onChange={(e) => setFilter('to', e.target.value)}
            />
          </Field>
        </div>

        {auditQuery.isError ? (
          <p className="mt-4 text-sm text-red-600">{(auditQuery.error as Error).message}</p>
        ) : queryShowsTableLoading(auditQuery) ? (
          <TableSkeleton rows={10} cols={5} />
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No audit entries match filters.</p>
        ) : (
          <>
            <Table className="mt-4 border-0">
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Target</TH>
                  <TH>Details</TH>
                </TR>
              </THead>
              <TBody>
                {entries.map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap text-xs">{formatDate(e.occurred_at)}</TD>
                    <TD>{e.actor_username ?? e.actor_user_id}</TD>
                    <TD className="font-mono text-xs">{e.action}</TD>
                    <TD className="text-xs">
                      {e.target_type ?? '—'}
                      {e.target_id ? ` · ${e.target_id}` : ''}
                    </TD>
                    <TD className="max-w-lg text-xs text-muted">{formatAuditDetails(e.details ?? {})}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination total={total} page={pagination.page} limit={pagination.limit} />
          </>
        )}
      </Card>
    </div>
  );
}

export function AuditLogPanel() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={5} />}>
      <AuditInner />
    </Suspense>
  );
}
