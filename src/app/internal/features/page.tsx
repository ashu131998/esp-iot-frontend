'use client';

import { useQuery } from '@tanstack/react-query';

import { FactoryFeaturesCard } from '@/components/admin/factory-features-card';
import { PageHeader } from '@/components/layout/internal-shell';
import { api } from '@/lib/api';

export default function InternalFeaturesPage() {
  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });

  return (
    <>
      <PageHeader title="Feature flags" description="Toggle optional dashboard pages per factory" />
      <div className="p-4 sm:p-6 lg:p-8">
        <FactoryFeaturesCard factories={factoriesQuery.data?.factories ?? []} />
      </div>
    </>
  );
}
