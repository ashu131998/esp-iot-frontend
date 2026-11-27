import { headers } from 'next/headers';

import { NotificationsGate } from '@/components/alerts-app/notifications-gate';
import { AlertsAppShell } from '@/components/alerts-app/shell';
import { isDashboardAppHost } from '@/lib/hosts';

/**
 * The signed-in pages (the middleware sends anyone else to the sign-in). On a phone (the iPhone app, the
 * Android app) they open only once notifications are on (components/alerts-app/notifications-gate.tsx).
 * Inside the FloorBeat app (dashboard.floorbeat.in/inbox, which a phone's browser opens too) only the
 * installed app is held back so.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const inside = isDashboardAppHost((await headers()).get('host'), process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST);
  return (
    <NotificationsGate installedOnly={inside}>
      <AlertsAppShell>{children}</AlertsAppShell>
    </NotificationsGate>
  );
}
