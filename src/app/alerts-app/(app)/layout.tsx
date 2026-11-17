import { AlertsAppShell } from '@/components/alerts-app/shell';

/** The signed-in pages (the middleware sends anyone else to /login). */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <AlertsAppShell>{children}</AlertsAppShell>;
}
