import { AddItemScreen } from '@/components/ims-app/add-item-screen';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/** Add item in the dashboard's Stock tab: stock added with no QR, an item and its own fields. */
async function FactoryImsAddPage({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  return <AddItemScreen factoryId={factoryId} />;
}

export default factoryPage('ims', FactoryImsAddPage);
