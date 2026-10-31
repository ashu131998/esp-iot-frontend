'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
 * The end of a list: the next rows load as it comes into view (a little before, so they are there
 * by the time the reader gets to them); a button does the same for keyboards and old browsers.
 * Says how many are shown; nothing for a list that fits in its first rows.
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

  if (total <= 0 || (!hasMore && total <= SCROLL_STEP)) return null;
  return (
    <div
      ref={ref}
      className={cn('flex items-center justify-between gap-3 border-t px-2 py-3 text-xs text-muted sm:px-4', className)}
    >
      <span>{hasMore ? `Showing ${shown} of ${total}` : `All ${total} shown`}</span>
      {hasMore && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onMore} disabled={loading}>
          {loading ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
