/**
 * How a line is named on the factory's pages. Our staff type IDs ("line-1", "press_shop"); the
 * factory's people read names. A line with a name of its own shows it; one named by its ID
 * alone shows the ID made readable: "line-1" → "Line 1", "press_shop-2" → "Press Shop 2".
 */
export function prettyId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function lineLabel(line: { line_id: string; name?: string | null } | null | undefined): string {
  if (!line) return '—';
  const name = (line.name ?? '').trim();
  if (name && name.toLowerCase() !== line.line_id.toLowerCase()) return name;
  return prettyId(line.line_id);
}
