import Link from 'next/link';

import { Card, CardHeader } from '@/components/ui/card';
import { NavDim } from '@/lib/navigation-context';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { Badge } from '@/components/ui/badge';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { serverApi } from '@/lib/server-api';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LinesPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const [{ lines }, { machines }] = await Promise.all([
    serverApi.lines(factoryId),
    serverApi.machines(factoryId),
  ]);

  const machineCountByLine = machines.reduce<Record<string, number>>((acc, machine) => {
    acc[machine.line_id] = (acc[machine.line_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <NavDim className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader
          title="Production Lines"
          description="Assembly and process lines configured for this factory"
          action={
            <ExportCsvButton
              filename="production-lines"
              headers={['Line ID', 'Name', 'Machines', 'Last Seen', 'Created']}
              rows={lines.map((line) => [
                line.line_id,
                line.name,
                machineCountByLine[line.line_id] ?? 0,
                line.last_seen_at,
                line.created_at,
              ])}
            />
          }
        />

        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No production lines configured yet.</p>
        ) : (
          <Table className="mt-2 border-0">
            <THead>
              <TR>
                <TH>Line ID</TH>
                <TH>Name</TH>
                <TH>Machines</TH>
                <TH>Last Seen</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {lines.map((line) => (
                <TR
                  key={line.line_id}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <TD className="font-mono text-xs">{line.line_id}</TD>
                  <TD className="font-medium">
                    <Link
                      href={`/factories/${factoryId}/lines/${line.line_id}`}
                      className="hover:underline text-primary"
                    >
                      {line.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge className="bg-blue-50 text-blue-700">
                      {machineCountByLine[line.line_id] ?? 0}
                    </Badge>
                  </TD>
                  <TD>{line.last_seen_at ? formatDate(line.last_seen_at) : '—'}</TD>
                  <TD>{formatDate(line.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </NavDim>
  );
}
