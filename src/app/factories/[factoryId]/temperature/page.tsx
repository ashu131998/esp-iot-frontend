import { TemperatureDashboard } from '@/components/factory/temperature-dashboard';

export const dynamic = 'force-dynamic';

export default function TemperaturePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TemperatureDashboard />
    </div>
  );
}
