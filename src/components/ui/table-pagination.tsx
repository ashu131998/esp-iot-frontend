'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useIsNavigating, useNavigate } from '@/lib/navigation-context';
import {
  LIMIT_PARAM,
  PAGE_PARAM,
  PAGE_SIZE_OPTIONS,
  coerceLimit,
  coercePage,
  coerceTotal,
  paginationRange,
} from '@/lib/pagination';
import { cn } from '@/lib/utils';

export function TablePagination({
  total,
  page,
  limit,
  className,
}: {
  total: number;
  page: number;
  limit: number;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const isPending = useIsNavigating();

  const safeTotal = coerceTotal(total);
  const safePage = coercePage(page);
  const safeLimit = coerceLimit(limit);
  const { totalPages, safePage: currentPage, start, end } = paginationRange({
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
  });
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    navigate(params.size ? `${pathname}?${params.toString()}` : pathname);
  };

  if (safeTotal <= 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t px-2 py-3 sm:px-4',
        isPending && 'opacity-70',
        className,
      )}
    >
      <p className="text-xs text-muted">
        Showing {start}–{end} of {safeTotal}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          Rows
          <Select
            className="h-8 w-auto min-w-[4.5rem] py-1 text-xs"
            value={String(safeLimit)}
            onChange={(e) =>
              updateParams({
                [LIMIT_PARAM]: e.target.value,
                [PAGE_PARAM]: undefined,
              })
            }
            disabled={isPending}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>

        <span className="text-xs text-muted">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={!hasPrev || isPending}
          onClick={() =>
            updateParams({
              [PAGE_PARAM]: hasPrev ? String(currentPage - 1) : undefined,
              [LIMIT_PARAM]: String(safeLimit),
            })
          }
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={!hasNext || isPending}
          onClick={() =>
            updateParams({
              [PAGE_PARAM]: String(currentPage + 1),
              [LIMIT_PARAM]: String(safeLimit),
            })
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}
