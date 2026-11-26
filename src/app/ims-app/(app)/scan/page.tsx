import { redirect } from 'next/navigation';

import { StockInScreen } from '@/components/ims-app/stock-in-screen';
import { sessionUser } from '@/lib/server/session-user';

export const dynamic = 'force-dynamic';

/** Scan (/scan): for now Stock in, a new pallet into stock. Move, Take out and Count join it as they are built. */
export default async function ImsScanPage() {
  const user = await sessionUser();
  if (user === undefined) return null;   // the layout says it could not connect
  if (!user?.factory_id) redirect('/');
  return <StockInScreen factoryId={user.factory_id} />;
}
