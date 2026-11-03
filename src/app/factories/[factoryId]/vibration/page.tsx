import { VibrationDashboard } from '@/components/factory/vibration-dashboard';
import { ChartSkeleton, StatGridSkeleton } from '@/components/ui/page-skeletons';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function VibrationPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar />
      <NavDim className="space-y-6">
        <QuerySuspense fallback={<><StatGridSkeleton count={2} /><ChartSkeleton /></>}>
          <VibrationDashboard factoryId={factoryId} />
        </QuerySuspense>
      </NavDim>
    </div>
  );
}

export default factoryPage('vibration', VibrationPage);
