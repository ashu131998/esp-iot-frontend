import { TemperatureDashboard } from '@/components/factory/temperature-dashboard';
import { requireFactoryPage } from '@/lib/server/page-guard';

export const dynamic = 'force-dynamic';

export default async function TemperaturePage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  await requireFactoryPage(factoryId, 'temperature');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TemperatureDashboard />
    </div>
  );
}
