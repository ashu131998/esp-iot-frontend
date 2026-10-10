import { ShiftReportSchedulePanel } from '@/components/factory/shift-report-schedule-panel';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

export default async function ShiftReportsPage({
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
