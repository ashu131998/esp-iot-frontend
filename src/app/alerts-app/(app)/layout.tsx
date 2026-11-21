import { NotificationsGate } from '@/components/alerts-app/notifications-gate';
import { AlertsAppShell } from '@/components/alerts-app/shell';

/**
 * The signed-in pages (the middleware sends anyone else to /login). On a phone (the iPhone app, the
 * Android app) they open only once notifications are on (components/alerts-app/notifications-gate.tsx).
 */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsGate>
      <AlertsAppShell>{children}</AlertsAppShell>
    </NotificationsGate>
  );
}
