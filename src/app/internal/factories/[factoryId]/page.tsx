import { FactorySetupPanel } from '@/components/internal/factory-setup-panel';
import { ReferralCard } from '@/components/internal/referral-card';
import { SubscriptionCard } from '@/components/internal/subscription-card';
import { PageHeader } from '@/components/layout/page-header';
import { WifiManager } from '@/components/wifi/wifi-manager';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function InternalFactorySetupPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  // The partner is on the staff factory list only (never on the factory's own record).
  const listed = await serverApi.factories().then(
    (d) => d.factories.find((f) => f.factory_id === factoryId) ?? null,
    () => null,
  );

  return (
    <>
      <PageHeader
        title="Factory setup"
        description="Lines, machines, node registration and WiFi for this site"
      />
      <FactorySetupPanel factoryId={factoryId} />
      <section className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <SubscriptionCard factoryId={factoryId} />
      </section>
      {listed && (
        <section className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <ReferralCard factoryId={factoryId} initial={listed.referred_by ?? null} />
        </section>
      )}
      <section className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <h2 className="text-lg font-semibold">WiFi</h2>
        <WifiManager factoryId={factoryId} />
      </section>
    </>
  );
}
