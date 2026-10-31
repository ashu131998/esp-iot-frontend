'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { QualityForm } from '@/components/factory/quality-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Button } from '@/components/ui/button';
import { LoadMore, ScrollTable } from '@/components/ui/load-more';
import { PHONE_HIDDEN, TBody, TD, THead, TH, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { useInfiniteList, type ListPage } from '@/lib/use-infinite-list';
import type { Machine, QualityRecord } from '@/lib/types';
import { cn, formatDate, formatNumber } from '@/lib/utils';

export function QualityPanel({
  factoryId,
  machines,
  first,
  from,
  to,
  machineId,
  lineId,
}: {
  factoryId: string;
  machines: Machine[];
  /** The first records, rendered on the server; more load as the list scrolls (useInfiniteList). */
  first: ListPage<QualityRecord>;
  from: string;
  to: string;
  machineId?: string;
  lineId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const listKey = ['quality-records', factoryId, from, to, machineId ?? '', lineId ?? ''];
  const { items: records, total, hasMore, more, loading } = useInfiniteList<QualityRecord>({
    queryKey: listKey,
    first,
    fetchPage: ({ limit, offset, signal }) =>
      api.quality(factoryId, { from, to, limit, offset, machine_id: machineId, line_id: lineId }, { signal })
        .then((r) => ({ items: r.records ?? [], total: r.total ?? 0 })),
  });
  // Added or deleted: every loaded page again (and the rest of the page from the server).
  const refreshList = () => {
    void queryClient.invalidateQueries({ queryKey: ['quality-records', factoryId] });
    router.refresh();
  };

  function recordToRow(r: QualityRecord) {
    const machine = machines.find((m) => m.machine_id === r.machine_id);
    return [
      machine?.name ?? r.machine_id,
      r.metric.replace(/_/g, ' '),
      r.value,
      r.unit,
      r.sample_size,
      r.source,
      r.recorded_at,
      r.notes,
    ];
  }

  async function fetchAllRows() {
    const allRecords = await fetchAllPages(({ limit: pageLimit, offset }) =>
      api.quality(factoryId, { from, to, limit: pageLimit, offset }).then((r) => ({
        items: r.records,
        total: r.total,
      })),
    );
    return allRecords.map(recordToRow);
  }

  const deleteMutation = useMutation({
    mutationFn: (recordId: string) => api.deleteQuality(factoryId, recordId),
    onSuccess: refreshList,
  });

  return (
    <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <Card>
        <CardHeader
          title="Quality Records"
          description="Manual QA entries and inspection results"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton
                filename="quality-records"
                headers={['Machine', 'Metric', 'Value', 'Unit', 'Sample', 'Source', 'Recorded', 'Notes']}
                fetchRows={fetchAllRows}
                rowCount={total}
              />
              <QualityForm factoryId={factoryId} machines={machines} onSuccess={refreshList} />
            </div>
          }
        />

        {records.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No quality records in this period. Adjust the date range or add a new record.</p>
        ) : (
          <>
            <ScrollTable className="mt-2 border-0" rowCount={records.length} resetKey={listKey.join('|')}>
              <THead>
                <TR>
                  <TH>Machine</TH>
                  <TH>Metric</TH>
                  <TH>Value</TH>
                  <TH>Sample</TH>
                  <TH className={PHONE_HIDDEN}>Source</TH>
                  <TH className={PHONE_HIDDEN}>Recorded</TH>
                  <TH className={PHONE_HIDDEN}>Notes</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {records.map((r) => {
                  const machine = machines.find((m) => m.machine_id === r.machine_id);
                  return (
                    <TR key={r.record_id}>
                      <TD className="font-medium">{machine?.name ?? r.machine_id}</TD>
                      <TD className="capitalize">{r.metric.replace(/_/g, ' ')}</TD>
                      <TD>
                        {formatNumber(r.value)} {r.unit}
                      </TD>
                      <TD>{r.sample_size ?? '—'}</TD>
                      <TD className={PHONE_HIDDEN}>
                        <Badge className="bg-blue-50 text-blue-700">{r.source}</Badge>
                      </TD>
                      <TD className={PHONE_HIDDEN}>{formatDate(r.recorded_at)}</TD>
                      <TD className={cn('max-w-xs truncate text-muted', PHONE_HIDDEN)}>{r.notes || '—'}</TD>
                      <TD>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate(r.record_id)}
                        >
                          Delete
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </ScrollTable>
            <LoadMore shown={records.length} total={total} hasMore={hasMore} onMore={more} loading={loading} />
          </>
        )}
      </Card>
    </div>
  );
}
