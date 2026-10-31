import { FactorySetupPanel } from '@/components/internal/factory-setup-panel';
import { PageHeader } from '@/components/layout/page-header';
import { WifiManager } from '@/components/wifi/wifi-manager';

export const dynamic = 'force-dynamic';

export default async function InternalFactorySetupPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;

  return (
    <>
      <PageHeader
        title="Factory setup"
        description="Lines, machines, node registration and WiFi for this site"
      />
      <FactorySetupPanel factoryId={factoryId} />
      <section className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        <h2 className="text-lg font-semibold">WiFi</h2>
        <WifiManager factoryId={factoryId} />
      </section>
    </>
  );
}
