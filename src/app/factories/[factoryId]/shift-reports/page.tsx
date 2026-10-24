import { ShiftReportSchedulePanel } from '@/components/factory/shift-report-schedule-panel';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function ShiftReportsPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <NavDim className="p-4 sm:p-6 lg:p-8">
      <ShiftReportSchedulePanel factoryId={factoryId} />
    </NavDim>
  );
}

export default factoryPage('shift-reports', ShiftReportsPage);
