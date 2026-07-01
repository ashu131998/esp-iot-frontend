import { ProductionDashboard } from '@/components/factory/production-dashboard';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { factoryId } = await params;
  const { from, to } = await searchParams;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar />
      <NavDim className="space-y-6">
        <ProductionDashboard factoryId={factoryId} from={from} to={to} />
      </NavDim>
    </div>
  );
}
