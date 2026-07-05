'use client';

import { Badge } from '@/components/ui/badge';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { useNavigate } from '@/lib/navigation-context';
import type { ProductionLine } from '@/lib/types';
import { formatDate } from '@/lib/utils';

function lineLabel(line: ProductionLine) {
  return line.name?.trim() || line.line_id;
}

export function LinesTable({
  factoryId,
  lines,
  machineCountByLine,
}: {
  factoryId: string;
  lines: ProductionLine[];
  machineCountByLine: Record<string, number>;
}) {
  const navigate = useNavigate();

  const openLine = (lineId: string) => {
    navigate(`/factories/${factoryId}/lines/${lineId}`);
  };

  return (
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
            role="link"
            tabIndex={0}
            className="cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => openLine(line.line_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLine(line.line_id);
              }
            }}
          >
            <TD className="font-mono text-xs">{line.line_id}</TD>
            <TD className="font-medium text-primary">{lineLabel(line)}</TD>
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
  );
}
