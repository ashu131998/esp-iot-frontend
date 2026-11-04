import { PageHeader } from '@/components/layout/internal-shell';
import { OnboardPanel } from '@/components/internal/onboard-panel';

export default function InternalOnboardPage() {
  return (
    <>
      <PageHeader title="Onboard factory" description="Set up a customer factory in one go, on site if you like: only the factory and one admin are required, everything else is optional" />
      <div className="p-4 sm:p-6 lg:p-8">
        <OnboardPanel />
      </div>
    </>
  );
}
