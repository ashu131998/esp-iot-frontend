import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { StockScreen } from '@/components/ims-app/stock-screen';
import { sessionUser } from '@/lib/server/session-user';
import { STAFF_FACTORY_HEADER, imsFactoryOf } from '@/lib/staff-factory';

export const dynamic = 'force-dynamic';

/** Available stock (/stock), with its filter in the address: ?spec.colour=grey&row=R03 (lib/ims/stock-filter.ts). */
export default async function ImsStockPage() {
  const user = await sessionUser();
  if (user === undefined) return null;   // the layout says it could not connect
  const factoryId = imsFactoryOf(user, (await headers()).get(STAFF_FACTORY_HEADER));
  if (!factoryId) redirect('/');
  return (
    <Suspense>
      <StockScreen factoryId={factoryId} />
    </Suspense>
  );
}
