import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getFactoryConfig } from '@/lib/factory-config';

/**
 * Factory-specific page — only registered for factories with customPages in factory-config.
 * Mumbai Precision Works includes ISO compliance tracking.
 */
export default async function CompliancePage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const config = getFactoryConfig(factoryId);
  const customPage = config.customPages?.find((p) => p.slug === 'compliance');

  const audits = [
    { id: 'ISO-9001', status: 'Certified', expiry: '2027-03-15', score: 94 },
    { id: 'ISO-14001', status: 'In Review', expiry: '2026-09-01', score: 88 },
    { id: 'IATF-16949', status: 'Certified', expiry: '2028-01-20', score: 91 },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader
          title="Compliance Dashboard"
          description={customPage?.description ?? 'Factory compliance and certification status'}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {audits.map((a) => (
            <div key={a.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{a.id}</h4>
                <Badge
                  className={
                    a.status === 'Certified'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }
                >
                  {a.status}
                </Badge>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Audit Score</dt>
                  <dd className="font-semibold">{a.score}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Expiry</dt>
                  <dd>{a.expiry}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          This page is factory-specific to {config.name}. Add more custom pages via{' '}
          <code className="rounded bg-slate-100 px-1">src/lib/factory-config.ts</code>.
        </p>
      </Card>
    </div>
  );
}
