'use client';

import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

import { SCROLL_STEP, nextOffset } from '@/lib/infinite';

export interface ListPage<T> {
  items: T[];
  total: number;
}

/**
 * A long list from the server, a page at a time as it scrolls (lib/infinite.ts). `first`: the first
 * page the server already rendered (shown at once, the next ones fetched from here). After a change
 * to the list, invalidate `queryKey`: every loaded page is fetched again.
 */
export function useInfiniteList<T>({
  queryKey,
  fetchPage,
  first,
  pageSize = SCROLL_STEP,
}: {
  queryKey: QueryKey;
  fetchPage: (page: { limit: number; offset: number; signal: AbortSignal }) => Promise<ListPage<T>>;
  first?: ListPage<T>;
  pageSize?: number;
}) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage({ limit: pageSize, offset: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      nextOffset(pages.reduce((n, p) => n + p.items.length, 0), last.total, last.items.length),
    ...(first ? { initialData: { pages: [first], pageParams: [0] }, staleTime: 30_000 } : {}),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const more = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  return {
    items,
    total: Math.max(total, items.length),
    hasMore: Boolean(hasNextPage),
    more,
    loading: isFetchingNextPage,
    query,
  };
}
