import { PerformanceDashboard } from '@/components/factory/performance-dashboard';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar />
      <NavDim className="space-y-6">
        <PerformanceDashboard factoryId={factoryId} />
      </NavDim>
    </div>
  );
}
