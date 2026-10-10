import { FactorySensorMappingPanel } from '@/components/factory/factory-sensor-mapping-panel';
import { NavDim } from '@/lib/navigation-context';

export const dynamic = 'force-dynamic';

export default async function SensorMappingPage({
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
