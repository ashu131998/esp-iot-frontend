import { PageHeader } from '@/components/layout/app-shell';
import { WifiManager } from '@/components/wifi/wifi-manager';
import { getT } from '@/lib/i18n/server';
import { NavDim } from '@/lib/navigation-context';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function FactoryWifiPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const { t } = await getT();

  return (
    <NavDim>
      <PageHeader title={t('WiFi')} description={t('The WiFi networks your boards use, and how to change them without losing a board')} />
      <div className="p-4 sm:p-6 lg:p-8">
        <WifiManager factoryId={factoryId} />
      </div>
    </NavDim>
  );
}

export default factoryPage('wifi', FactoryWifiPage);
