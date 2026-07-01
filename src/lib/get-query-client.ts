import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

/** Request-scoped QueryClient for server-side prefetch + dehydration. */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    }),
);
