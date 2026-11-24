
import { SignOutButton } from '@/components/auth/sidebar-user-footer';
import { DashboardAppMark } from '@/components/dashboard-app/app-mark';
import { AppLink } from '@/components/ui/app-link';
import { Card, CardHeader } from '@/components/ui/card';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/**
 * The FloorBeat app for our own staff, who belong to no factory: the factories, to open one's dashboard
 * (at its long address here). Factory accounts never see this page: the app opens on their own factory.
 */
export default async function DashboardAppFactoriesPage() {
  const { factories } = await serverApi.factories().catch(() => ({ factories: [] }));
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 bg-background px-4 py-8">
      <Card className="p-6">
        <DashboardAppMark className="mb-4 h-12 w-12" />
        <CardHeader title="Open a factory" description="You are signed in as FloorBeat staff. Pick the factory whose dashboard to open." />
        {factories.length === 0 ? (
          <p className="text-sm text-muted">No factories found.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {factories.map((f) => (
              <li key={f.factory_id}>
                <AppLink href={`/factories/${f.factory_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{f.name ?? f.factory_id}</span>
                    <span className="block truncate font-mono text-xs text-muted">{f.factory_id}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted">›</span>
                </AppLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <SignOutButton className="mx-auto text-sm text-muted hover:text-foreground" />
    </div>
  );
}
