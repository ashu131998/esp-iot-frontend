import { StockInScreen } from '@/components/ims-app/stock-in-screen';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/** Scan in the dashboard's Stock tab: for now Stock in (a new pallet into stock). */
async function FactoryImsScanPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return <StockInScreen factoryId={factoryId} />;
}

export default factoryPage('ims', FactoryImsScanPage);
