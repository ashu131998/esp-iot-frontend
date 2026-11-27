import { ImsHome } from '@/components/ims-app/home';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

/** The Stock tab's home: Stock in, Available stock. */
function FactoryImsPage() {
  return <ImsHome />;
}

export default factoryPage('ims', FactoryImsPage);
