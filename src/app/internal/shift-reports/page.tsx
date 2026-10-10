import { PageHeader } from '@/components/layout/app-shell';
import { ShiftReportJobPanel } from '@/components/internal/shift-report-job-panel';

export const dynamic = 'force-dynamic';

export default function InternalShiftReportsPage() {
  return (
    <>
      <PageHeader
        title="Shift report scheduler"
        description="Platform job that emails factory owners after each shift. Enable and tune the interval here — no external cron required."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <ShiftReportJobPanel />
      </div>
    </>
  );
}
