'use client';

import { useQuery } from '@tanstack/react-query';

import { FactoryDisplayEditor } from '@/components/admin/factory-display-editor';
import { PageHeader } from '@/components/layout/internal-shell';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { api } from '@/lib/api';
import { queryShowsTableLoading } from '@/lib/query-table-loading';

export default function InternalFeaturesPage() {
  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });
  const catalogQuery = useQuery({
    queryKey: ['admin-display-catalog'],
    queryFn: ({ signal }) => api.adminDisplayCatalog({ signal }),
    staleTime: Infinity,
  });

  return (
    <>
      <PageHeader
        title="Pages & sections"
        description="Switch dashboard pages, and parts of pages, per factory"
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {queryShowsTableLoading(factoriesQuery) || queryShowsTableLoading(catalogQuery) ? (
          <TableSkeleton rows={8} cols={2} />
        ) : catalogQuery.error ? (
          <p className="text-sm text-red-600">Could not load the page list: {catalogQuery.error.message}</p>
        ) : (
          <FactoryDisplayEditor
            factories={factoriesQuery.data?.factories ?? []}
            pages={catalogQuery.data?.pages ?? []}
          />
        )}
      </div>
    </>
  );
}
