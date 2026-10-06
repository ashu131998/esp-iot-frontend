import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { FactoryOverviewDashboard } from '@/components/factory/factory-overview-dashboard';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

/** Overview metrics + machine table — data loads on the client (see FactoryOverviewDashboard). */
export default async function FactoryOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar from={sp.from} to={sp.to} />
      <NavDim className="space-y-6">
        <FactoryOverviewDashboard factoryId={factoryId} from={sp.from} to={sp.to} />
      </NavDim>
    </div>
  );
}
