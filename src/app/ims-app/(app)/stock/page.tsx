import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { StockScreen } from '@/components/ims-app/stock-screen';
import { sessionUser } from '@/lib/server/session-user';

export const dynamic = 'force-dynamic';

/** Available stock (/stock), with its filter in the address: ?spec.colour=grey&row=R03 (lib/ims/stock-filter.ts). */
export default async function ImsStockPage() {
  const user = await sessionUser();
  if (!user?.factory_id) redirect('/');
  return (
    <Suspense>
      <StockScreen factoryId={user.factory_id} />
    </Suspense>
  );
}
