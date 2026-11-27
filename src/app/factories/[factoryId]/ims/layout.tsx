import { ImsDashboardFrame } from '@/components/ims-app/dashboard-frame';
import { requireFactoryPage } from '@/lib/server/page-guard';

/**
 * The dashboard's Stock tab (FloorBeat IMS inside the dashboard), our staff's: /ims, /ims/add, /ims/stock. The
 * factory's own people have it as an app of its own in the FloorBeat app (middleware.ts serves dashboard.floorbeat.in/ims
 * from app/ims-app). Only for a factory our staff switched the IMS on for (display `ims`); its API refuses the rest too (403).
 */
export default async function FactoryImsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  await requireFactoryPage(factoryId, 'ims');
  return <ImsDashboardFrame factoryId={factoryId}>{children}</ImsDashboardFrame>;
}
