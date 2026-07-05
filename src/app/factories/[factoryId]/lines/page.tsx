import { LinesTable } from '@/components/factory/lines-table';
import { Card, CardHeader } from '@/components/ui/card';
import { NavDim } from '@/lib/navigation-context';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { serverApi } from '@/lib/server-api';

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
                line.name?.trim() || line.line_id,
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
          <LinesTable
            factoryId={factoryId}
            lines={lines}
            machineCountByLine={machineCountByLine}
          />
        )}
      </Card>
    </NavDim>
  );
}
