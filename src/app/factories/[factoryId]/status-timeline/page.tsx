import { StatusTimelineDashboard } from '@/components/uptime/status-timeline-dashboard';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

export default async function StatusTimelinePage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <div className="space-y-6">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <DateRangeToolbar hideDateRange />
      </div>
      <NavDim>
        <StatusTimelineDashboard factoryId={factoryId} />
      </NavDim>
    </div>
  );
}
