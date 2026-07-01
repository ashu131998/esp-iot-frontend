/** Matches backend `pagination.maxLimit` (default 500). */
export const EXPORT_PAGE_SIZE = 500;

export async function fetchAllPages<T>(
  fetchPage: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const { items, total: pageTotal } = await fetchPage({ limit: EXPORT_PAGE_SIZE, offset });
    total = pageTotal;
    all.push(...items);
    offset += items.length;
    if (items.length === 0) break;
  }

  return all;
}
