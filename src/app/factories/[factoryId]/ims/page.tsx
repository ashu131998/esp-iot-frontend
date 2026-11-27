import { redirect } from 'next/navigation';

import { factoryLinks } from '@/lib/server/factory-links';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/**
 * The Stock tab's own address (/ims in the FloorBeat app): its main screen, Available stock. Its two screens are
 * tabs at the top (components/ims-app/dashboard-frame.tsx); the app's home screen is where the apps are picked,
 * so the stock has no home screen of its own here.
 */
async function FactoryImsPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  const link = await factoryLinks(factoryId);
  return redirect(link(`/factories/${factoryId}/ims/stock`));
}

export default factoryPage('ims', FactoryImsPage);
