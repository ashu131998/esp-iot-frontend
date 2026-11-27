import { ImsHome } from '@/components/ims-app/home';

export const dynamic = 'force-dynamic';

/** IMS's home (/). The same screen is the dashboard's Stock tab (factories/[factoryId]/ims). */
export default function ImsHomePage() {
  return <ImsHome />;
}
