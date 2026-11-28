import { HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

import { NotificationsGate } from '@/components/alerts-app/notifications-gate';
import { AlertsAppShell } from '@/components/alerts-app/shell';
import { isDashboardAppHost } from '@/lib/hosts';
import { alertsAhead } from '@/lib/server/alerts-ahead';

/**
 * The signed-in pages (the middleware sends anyone else to the sign-in). On a phone (the iPhone app, the
 * Android app) they open only once notifications are on (components/alerts-app/notifications-gate.tsx).
 * Inside the FloorBeat app (dashboard.floorbeat.in/inbox, which a phone's browser opens too) only the
 * installed app is held back so. The person's alerts come with the page (lib/server/alerts-ahead.ts): the
 * inbox shows at once, without the phone asking for them after.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const [host, ahead] = await Promise.all([headers().then((h) => h.get('host')), alertsAhead()]);
  const inside = isDashboardAppHost(host, process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST);
  return (
    <HydrationBoundary state={ahead}>
      <NotificationsGate installedOnly={inside}>
        <AlertsAppShell>{children}</AlertsAppShell>
      </NotificationsGate>
    </HydrationBoundary>
  );
}
