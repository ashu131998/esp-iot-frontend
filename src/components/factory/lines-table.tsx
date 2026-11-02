'use client';

import { ListGroup, ListRow } from '@/components/ui/simple';
import { useT } from '@/lib/i18n/context';
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
  const { t, tn } = useT();
  return (
    <ListGroup title={t('Lines')} count={lines.length} action={action}>
      {lines.map((line) => (
        <ListRow
          key={line.line_id}
          href={`/factories/${factoryId}/lines/${line.line_id}`}
          title={lineLabel(line)}
          detail={tn(machineCountByLine[line.line_id] ?? 0, '{count} machine', '{count} machines')}
        />
      ))}
    </ListGroup>
  );
}
