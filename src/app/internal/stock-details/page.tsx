'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { StockDetailsPanel } from '@/components/internal/stock-details-panel';
import { PageHeader } from '@/components/layout/internal-shell';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { api } from '@/lib/api';
import { displayOf } from '@/lib/display';
import { queryShowsTableLoading } from '@/lib/query-table-loading';

/** Per factory with the IMS on: the details Add stock asks for in the stock app. Our staff only. */
export default function InternalStockDetailsPage() {
  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });
  const [factoryId, setFactoryId] = useState('');

  const factories = (factoriesQuery.data?.factories ?? []).filter((f) => displayOf(f).ims === true);
  const factory = factories.find((f) => f.factory_id === factoryId) ?? factories[0];

  let body;
  if (queryShowsTableLoading(factoriesQuery)) {
    body = <TableSkeleton rows={6} cols={3} />;
  } else if (factoriesQuery.error) {
    body = <p className="text-sm text-red-600">Could not load the factories: {factoriesQuery.error.message}</p>;
  } else if (!factory) {
    body = <p className="text-sm text-muted">No factory has the IMS switched on. Switch it on in Pages &amp; branding first.</p>;
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
        {/* key: each factory starts with its own sheets closed */}
        <StockDetailsPanel key={factory.factory_id} factoryId={factory.factory_id} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Stock details"
        description="Per factory: what the IMS app asks for when stock is added (pick-lists, text, numbers, photos, audio, video)"
      />
      <div className="p-4 sm:p-6 lg:p-8">{body}</div>
    </>
  );
}
