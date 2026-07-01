export type CsvCell = string | number | null | undefined;

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellToString(value: CsvCell): string {
  if (value == null) return '';
  return String(value);
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cellToString(cell))).join(','));
  return [headerLine, ...body].join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
