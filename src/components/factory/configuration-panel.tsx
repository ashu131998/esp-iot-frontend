'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ConfigurationForm } from '@/components/factory/configuration-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/ui/table-pagination';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { Machine, MachineConfiguration, ProductionLine } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export function ConfigurationPanel({
  factoryId,
  machines,
  lines,
  configurations,
  total,
  page,
  limit,
}: {
  factoryId: string;
  machines: Machine[];
  lines: ProductionLine[];
  configurations: MachineConfiguration[];
  total: number;
  page: number;
  limit: number;
}) {
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: (configId: string) => api.deleteConfiguration(factoryId, configId),
    onSuccess: () => router.refresh(),
  });

  function targetLabel(config: MachineConfiguration) {
    if (config.line_id && !config.machine_id) {
      const line = lines.find((l) => l.line_id === config.line_id);
      return line ? `${line.name} (line)` : `${config.line_id} (line)`;
    }

    const machine = machines.find((m) => m.machine_id === config.machine_id);
    return machine?.name ?? config.machine_id ?? '—';
  }

  function configToRow(c: MachineConfiguration) {
    return [
      targetLabel(c),
      c.key,
      c.value,
      c.unit,
      c.description,
      c.source,
      c.updated_at,
    ];
  }

  async function fetchAllRows() {
    const allConfigs = await fetchAllPages(({ limit: pageLimit, offset }) =>
      api.configurations(factoryId, { limit: pageLimit, offset }).then((r) => ({
        items: r.configurations,
        total: r.total,
      })),
    );
    return allConfigs.map(configToRow);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader
          title="Configuration"
          description="Operational parameters and setpoints per machine or line"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton
                filename="machine-configuration"
                headers={['Target', 'Parameter', 'Value', 'Unit', 'Description', 'Source', 'Updated']}
                fetchRows={fetchAllRows}
                rowCount={total}
              />
              <ConfigurationForm factoryId={factoryId} machines={machines} lines={lines} />
            </div>
          }
        />

        {configurations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No configurations yet. Add parameters using the button above.
          </p>
        ) : (
          <>
            <Table className="mt-2 border-0">
              <THead>
                <TR>
                  <TH>Target</TH>
                  <TH>Parameter</TH>
                  <TH>Value</TH>
                  <TH>Unit</TH>
                  <TH>Description</TH>
                  <TH>Source</TH>
                  <TH>Updated</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {configurations.map((c) => (
                  <TR key={c.config_id}>
                    <TD className="font-medium">{targetLabel(c)}</TD>
                    <TD className="font-mono text-xs">{c.key}</TD>
                    <TD className="font-semibold">{String(c.value)}</TD>
                    <TD>{c.unit || '—'}</TD>
                    <TD className="max-w-xs text-muted">{c.description || '—'}</TD>
                    <TD>
                      <Badge className="bg-violet-50 text-violet-700">{c.source}</Badge>
                    </TD>
                    <TD>{formatDate(c.updated_at)}</TD>
                    <TD>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => deleteMutation.mutate(c.config_id)}
                      >
                        Delete
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <TablePagination total={total} page={page} limit={limit} />
          </>
        )}
      </Card>
    </div>
  );
}
