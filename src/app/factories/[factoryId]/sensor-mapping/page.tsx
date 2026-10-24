import { FactorySensorMappingPanel } from '@/components/factory/factory-sensor-mapping-panel';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function SensorMappingPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <NavDim className="p-4 sm:p-6 lg:p-8">
      <FactorySensorMappingPanel factoryId={factoryId} />
    </NavDim>
  );
}

export default factoryPage('sensor-mapping', SensorMappingPage);
