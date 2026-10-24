import { VibrationDashboard } from '@/components/factory/vibration-dashboard';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

// The switch check runs in factoryPage, which is all this page needs the factory for.
async function VibrationPage() {

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <VibrationDashboard />
    </div>
  );
}

export default factoryPage('vibration', VibrationPage);
