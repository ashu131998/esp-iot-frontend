import { VibrationDashboard } from '@/components/factory/vibration-dashboard';

export const dynamic = 'force-dynamic';

export default function VibrationPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <VibrationDashboard />
    </div>
  );
}
