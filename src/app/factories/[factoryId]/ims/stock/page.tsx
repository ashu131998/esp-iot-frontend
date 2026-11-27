import { Suspense } from 'react';

import { StockScreen } from '@/components/ims-app/stock-screen';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/** Available stock in the dashboard's Stock tab, its filter in the address (lib/ims/stock-filter.ts). */
async function FactoryImsStockPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return (
    <Suspense>
      <StockScreen factoryId={factoryId} />
    </Suspense>
  );
}

export default factoryPage('ims', FactoryImsStockPage);
