import { redirect } from 'next/navigation';

import { AddItemScreen } from '@/components/ims-app/add-item-screen';
import { sessionUser } from '@/lib/server/session-user';

export const dynamic = 'force-dynamic';

/** Add item (/add): stock added with no QR, an item and its own fields. */
export default async function ImsAddPage() {
  const user = await sessionUser();
  if (user === undefined) return null;   // the layout says it could not connect
  if (!user?.factory_id) redirect('/');
  return <AddItemScreen factoryId={user.factory_id} />;
}
