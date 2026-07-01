'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { QualityForm } from '@/components/factory/quality-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/ui/table-pagination';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { Machine, QualityRecord } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/utils';

export function QualityPanel({
  factoryId,
  machines,
  records,
  from,
  to,
  rangeLabel,
  total,
  page,
  limit,
}: {
  factoryId: string;
  machines: Machine[];
  records: QualityRecord[];
  from: string;
  to: string;
  rangeLabel: string;
  total: number;
  page: number;
  limit: number;
}) {
  const router = useRouter();

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
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <Card>
        <CardHeader
          title="Quality Records"
          description={`Manual QA entries and inspection results · ${rangeLabel}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton
                filename="quality-records"
                headers={['Machine', 'Metric', 'Value', 'Unit', 'Sample', 'Source', 'Recorded', 'Notes']}
                fetchRows={fetchAllRows}
                rowCount={total}
              />
              <QualityForm factoryId={factoryId} machines={machines} />
            </div>
          }
        />

        {records.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No quality records in this period. Adjust the date range or add a new record.</p>
        ) : (
          <>
            <Table className="mt-2 border-0">
              <THead>
                <TR>
                  <TH>Machine</TH>
                  <TH>Metric</TH>
                  <TH>Value</TH>
                  <TH>Sample</TH>
                  <TH>Source</TH>
                  <TH>Recorded</TH>
                  <TH>Notes</TH>
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
                      <TD>
                        <Badge className="bg-blue-50 text-blue-700">{r.source}</Badge>
                      </TD>
                      <TD>{formatDate(r.recorded_at)}</TD>
                      <TD className="max-w-xs truncate text-muted">{r.notes || '—'}</TD>
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
            </Table>
            <TablePagination total={total} page={page} limit={limit} />
          </>
        )}
      </Card>
    </div>
  );
}
