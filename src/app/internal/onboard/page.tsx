import { PageHeader } from '@/components/layout/internal-shell';
import { OnboardPanel } from '@/components/internal/onboard-panel';

export default function InternalOnboardPage() {
  return (
    <>
      <PageHeader title="Onboard factory" description="Create a new customer factory and factory admin" />
      <div className="p-4 sm:p-6 lg:p-8">
        <OnboardPanel />
      </div>
    </>
  );
}
