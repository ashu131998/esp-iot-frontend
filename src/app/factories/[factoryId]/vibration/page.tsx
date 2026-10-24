import { VibrationDashboard } from '@/components/factory/vibration-dashboard';
import { requireFactoryPage } from '@/lib/server/page-guard';

export const dynamic = 'force-dynamic';

export default async function VibrationPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  await requireFactoryPage(factoryId, 'vibration');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <VibrationDashboard />
    </div>
  );
}
