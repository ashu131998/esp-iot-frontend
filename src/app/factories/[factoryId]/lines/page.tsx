import { LinesTable } from '@/components/factory/lines-table';
import { ListEmpty, ListGroup } from '@/components/ui/simple';
import { NavDim } from '@/lib/navigation-context';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function LinesPage({
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
      {lines.length === 0 ? (
        <ListGroup title="Lines">
          <ListEmpty>No lines set up yet.</ListEmpty>
        </ListGroup>
      ) : (
        <LinesTable
          factoryId={factoryId}
          lines={lines}
          machineCountByLine={machineCountByLine}
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
      )}
    </NavDim>
  );
}

export default factoryPage('lines', LinesPage);
