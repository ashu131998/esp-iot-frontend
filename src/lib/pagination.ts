export const PAGE_SIZE_OPTIONS = [10, 20, 30] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 10;

export const PAGE_PARAM = 'page';
export const LIMIT_PARAM = 'limit';

export type PaginationSearchParams = {
  page?: string;
  limit?: string;
};

export interface ResolvedPagination {
  page: number;
  limit: PageSize;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export function parsePageSize(value?: string | number): PageSize {
  const n = Number(value);
  if (PAGE_SIZE_OPTIONS.includes(n as PageSize)) return n as PageSize;
  return DEFAULT_PAGE_SIZE;
}

export function resolvePagination(params: PaginationSearchParams = {}): ResolvedPagination {
  const limit = parsePageSize(params.limit);
  let page = Number(params.page);
  if (Number.isNaN(page) || page < 1) page = 1;
  return { page, limit, offset: (page - 1) * limit };
}

export function coerceTotal(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Prefer API total; if missing, estimate so "Next" works on full pages. */
export function resolveListTotal(
  apiTotal: unknown,
  itemCount: number,
  limit: number,
  offset: number,
): number {
  const parsed = Number(apiTotal);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  if (itemCount >= limit) return offset + itemCount + 1;
  return offset + itemCount;
}

export function coercePage(value: unknown, fallback = 1): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function coerceLimit(value: unknown, fallback: PageSize = DEFAULT_PAGE_SIZE): PageSize {
  return parsePageSize(Number.isFinite(Number(value)) ? Number(value) : fallback);
}

export function paginationRange(meta: Partial<PaginationMeta>) {
  const total = coerceTotal(meta.total);
  const limit = coerceLimit(meta.limit);
  const page = coercePage(meta.page);
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(safePage * limit, total);
  return { totalPages, safePage, start, end, total, limit };
}

export function paginationQuery(pagination: ResolvedPagination): Record<string, string> {
  const q: Record<string, string> = {
    [LIMIT_PARAM]: String(pagination.limit),
  };
  if (pagination.page > 1) q[PAGE_PARAM] = String(pagination.page);
  return q;
}
