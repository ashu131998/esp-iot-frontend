import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { AddItemScreen } from '@/components/ims-app/add-item-screen';
import { sessionUser } from '@/lib/server/session-user';
import { STAFF_FACTORY_HEADER, imsFactoryOf } from '@/lib/staff-factory';

export const dynamic = 'force-dynamic';

/** Add item (/add): stock added with no QR, an item and its own fields. */
export default async function ImsAddPage() {
  const user = await sessionUser();
  if (user === undefined) return null;   // the layout says it could not connect
  const factoryId = imsFactoryOf(user, (await headers()).get(STAFF_FACTORY_HEADER));
  if (!factoryId) redirect('/');
  return <AddItemScreen factoryId={factoryId} />;
}
