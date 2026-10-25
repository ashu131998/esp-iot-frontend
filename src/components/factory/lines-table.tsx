'use client';

import { ListGroup, ListRow } from '@/components/ui/simple';
import { plural } from '@/lib/plain-words';
import type { ProductionLine } from '@/lib/types';

function lineLabel(line: ProductionLine) {
  return line.name?.trim() || line.line_id;
}

export function LinesTable({
  factoryId,
  lines,
  machineCountByLine,
  action,
}: {
  factoryId: string;
  lines: ProductionLine[];
  machineCountByLine: Record<string, number>;
  action?: React.ReactNode;
}) {
  return (
    <ListGroup title="Lines" count={lines.length} action={action}>
      {lines.map((line) => (
        <ListRow
          key={line.line_id}
          href={`/factories/${factoryId}/lines/${line.line_id}`}
          title={lineLabel(line)}
          detail={plural(machineCountByLine[line.line_id] ?? 0, 'machine')}
        />
      ))}
    </ListGroup>
  );
}
