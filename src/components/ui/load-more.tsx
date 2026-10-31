'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SCROLL_STEP, nextShown } from '@/lib/infinite';
import { cn } from '@/lib/utils';

/**
 * A list loaded whole, shown a step at a time as it scrolls (lib/infinite.ts). `resetKey`: what the
 * list is of (dates, filters); when it changes the list starts again from its first rows.
 */
export function useShowMore(total: number, resetKey: string, step = SCROLL_STEP) {
  const [state, setState] = useState({ key: resetKey, shown: step });
  const current = state.key === resetKey ? state.shown : step;
  const shown = Math.min(current, total);
  const more = useCallback(() => {
    setState((s) => ({ key: resetKey, shown: nextShown(s.key === resetKey ? s.shown : step, total, step) }));
  }, [resetKey, total, step]);
  return { shown, more, hasMore: shown < total };
}

/**
 * The end of a list (user, 2026-10-31: "nothing in the table moves"): the next rows are asked for as
 * it comes into view (a little before, so they are usually there by the time the reader is); while
 * they load, a spinner holds their place, and they appear below the rows already shown, which never
 * move. Its height never changes. A button does the same for keyboards and old browsers.
 */
export function LoadMore({
  shown,
  total,
  hasMore,
  onMore,
  loading = false,
  className,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  onMore: () => void;
  loading?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMore();
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
    // A new observer after every step: if the end is still in view (a short page), the next step comes too.
  }, [hasMore, loading, onMore, shown]);

  if (total <= 0 || (!hasMore && !loading && total <= SCROLL_STEP)) return null;
  return (
    <div
      ref={ref}
      className={cn('flex h-12 items-center justify-between gap-3 border-t px-2 text-xs text-muted sm:px-4', className)}
      aria-live="polite"
    >
      {loading ? (
        <span className="flex w-full items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading more…
        </span>
      ) : hasMore ? (
        <>
          <span>Showing {shown} of {total}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onMore}>
            Show more
          </Button>
        </>
      ) : (
        <span>All {total} shown</span>
      )}
    </div>
  );
}

/**
 * A table for a list that grows as it scrolls (components/ui/table's Table, plus): once its first
 * rows are drawn, its column widths are held, so rows added later (a longer name, say) wrap inside
 * their cells instead of widening a column and shifting the rows above. Measured again when the
 * window changes size or the list starts again (`resetKey`).
 */
export function ScrollTable({
  children,
  className,
  rowCount,
  resetKey = '',
}: {
  children: React.ReactNode;
  className?: string;
  rowCount: number;
  resetKey?: string;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const hasRows = rowCount > 0;

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !hasRows) return;
    const heads = () => Array.from(table.querySelectorAll<HTMLTableCellElement>(':scope > thead > tr:first-child > th'));
    const hold = () => {
      table.style.tableLayout = 'auto';
      for (const th of heads()) th.style.width = '';
      const widths = heads().map((th) => th.getBoundingClientRect().width);
      heads().forEach((th, i) => { if (widths[i] > 0) th.style.width = `${widths[i]}px`; });
      table.style.tableLayout = 'fixed';
    };
    hold();
    let frame = 0;
    let lastWidth = table.parentElement?.clientWidth ?? 0;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const width = table.parentElement?.clientWidth ?? 0;
      if (width === lastWidth) return;   // only a change of the space it has, not of its own rows
      lastWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(hold);
    });
    if (table.parentElement) ro?.observe(table.parentElement);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hasRows, resetKey]);

  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      <table ref={tableRef} className="w-full text-sm">{children}</table>
    </div>
  );
}
