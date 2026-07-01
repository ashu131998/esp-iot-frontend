import { PageHeader } from '@/components/layout/app-shell';
import { Card, CardHeader } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration and preferences" />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <Card>
          <CardHeader title="API Connection" description="Backend query API endpoint" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Query API</dt>
              <dd className="font-mono">{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Ingestion API</dt>
              <dd className="font-mono">http://localhost:8000</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Organization" description="Tenant settings (placeholder for auth integration)" />
          <p className="text-sm text-muted">
            User authentication, RBAC, and tenant management will be integrated here for production deployment.
          </p>
        </Card>
      </div>
    </>
  );
}
