import { TemperatureDashboard } from '@/components/factory/temperature-dashboard';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

// The switch check runs in factoryPage, which is all this page needs the factory for.
async function TemperaturePage() {

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TemperatureDashboard />
    </div>
  );
}

export default factoryPage('temperature', TemperaturePage);
