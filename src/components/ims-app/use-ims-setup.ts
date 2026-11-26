'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { imsApi, retryImsCall } from '@/lib/ims/api';
import type { ApiSetup } from '@/lib/ims/types';

const KEY = (factoryId: string) => `fb_ims_setup:${factoryId}`;

function kept(factoryId: string): ApiSetup | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const text = window.localStorage.getItem(KEY(factoryId));
    const value = text ? (JSON.parse(text) as ApiSetup) : undefined;
    return value && Array.isArray(value.products) && Array.isArray(value.locations) && Array.isArray(value.spec_fields) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The factory's products, spec fields and locations (GET …/ims/setup), kept on the phone too, so Stock
 * in works with no connection: the last copy shows at once and is asked for again in the background.
 */
export function useImsSetup(factoryId: string) {
  const query = useQuery({
    queryKey: ['ims-setup', factoryId],
    queryFn: ({ signal }) => imsApi.setup(factoryId, signal),
    // the kept copy at once, counted as old so it is asked for again; it stays if that fails
    initialData: () => kept(factoryId),
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: retryImsCall,
  });

  useEffect(() => {
    if (!query.data) return;
    try {
      window.localStorage.setItem(KEY(factoryId), JSON.stringify(query.data));
    } catch {
      // full: the copy in memory still works
    }
  }, [factoryId, query.data]);

  return { data: query.data, error: query.error, refetch: query.refetch, loading: !query.data && query.isPending };
}
