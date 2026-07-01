import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/table';
import { serverApi } from '@/lib/server-api';

export default async function FactoriesPage() {
  let factories;
  try {
    const data = await serverApi.factories();
    factories = data.factories;
  } catch (err) {
    return (
      <>
        <PageHeader title="Factories" description="Manage and monitor all factory sites" />
        <div className="p-4 sm:p-6 lg:p-8">
          <ErrorState message={err instanceof Error ? err.message : 'Failed to load factories'} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Factories" description="Manage and monitor all factory sites" />
      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 lg:p-8 xl:grid-cols-3">
        {factories.map((f) => (
          <Card key={f.factory_id} className="flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{f.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  {f.location ?? 'Location not set'}
                </p>
              </div>
              <Badge className="capitalize bg-slate-100 text-slate-700">{f.tier}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted">Machines</dt>
                <dd className="font-semibold">{f.machine_count}</dd>
              </div>
              <div>
                <dt className="text-muted">Lines</dt>
                <dd className="font-semibold">{f.line_count}</dd>
              </div>
              <div>
                <dt className="text-muted">Devices</dt>
                <dd className="font-semibold">{f.device_count}</dd>
              </div>
            </dl>
            <Link
              href={`/factories/${f.factory_id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
