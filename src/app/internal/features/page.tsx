'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FactoryBrandingCard } from '@/components/admin/factory-branding-card';
import { FactoryDisplayEditor } from '@/components/admin/factory-display-editor';
import { PageHeader } from '@/components/layout/internal-shell';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { api } from '@/lib/api';
import { queryShowsTableLoading } from '@/lib/query-table-loading';

/** Per-factory setup only our staff change: branding, and which pages / parts it shows. */
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
  const [factoryId, setFactoryId] = useState('');

  const factories = factoriesQuery.data?.factories ?? [];
  const factory = factories.find((f) => f.factory_id === factoryId) ?? factories[0];

  let body;
  if (queryShowsTableLoading(factoriesQuery) || queryShowsTableLoading(catalogQuery)) {
    body = <TableSkeleton rows={8} cols={2} />;
  } else if (catalogQuery.error) {
    body = <p className="text-sm text-red-600">Could not load the page list: {catalogQuery.error.message}</p>;
  } else if (!factory) {
    body = <p className="text-sm text-muted">No factories found.</p>;
  } else {
    body = (
      <div className="space-y-6">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Factory</span>
          <select
            value={factory.factory_id}
            onChange={(e) => setFactoryId(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            {factories.map((f) => (
              <option key={f.factory_id} value={f.factory_id}>
                {f.name} ({f.factory_id})
              </option>
            ))}
          </select>
        </label>
        {/* key: start each factory with fresh (unsaved) editor state */}
        <FactoryBrandingCard key={`brand-${factory.factory_id}`} factory={factory} />
        <FactoryDisplayEditor
          key={`pages-${factory.factory_id}`}
          factory={factory}
          pages={catalogQuery.data?.pages ?? []}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pages & branding"
        description="Per factory: logo and colour, and which dashboard pages and parts it shows"
      />
      <div className="p-4 sm:p-6 lg:p-8">{body}</div>
    </>
  );
}
