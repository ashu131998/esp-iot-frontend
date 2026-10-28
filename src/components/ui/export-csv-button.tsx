'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { buildCsv, downloadCsv, type CsvCell } from '@/lib/export-csv';
import { cn } from '@/lib/utils';

export function ExportCsvButton({
  filename,
  headers,
  rows,
  fetchRows,
  rowCount,
  disabled,
  className,
}: {
  filename: string;
  headers: string[];
  rows?: CsvCell[][];
  fetchRows?: () => Promise<CsvCell[][]>;
  rowCount?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const isEmpty = rowCount !== undefined ? rowCount === 0 : (rows?.length ?? 0) === 0;

  async function handleExport() {
    setLoading(true);
    try {
      const data = fetchRows ? await fetchRows() : (rows ?? []);
      downloadCsv(buildCsv(headers, data), filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      // Not on phones: a CSV download is for a computer.
      className={cn('hidden sm:inline-flex', className)}
      disabled={(disabled ?? isEmpty) || loading}
      onClick={handleExport}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {loading ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}
