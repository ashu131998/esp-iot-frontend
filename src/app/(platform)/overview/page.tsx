import { PageHeader } from '@/components/layout/app-shell';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { StatCard } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/table';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { serverApi } from '@/lib/server-api';
import { formatNumber, formatPercent } from '@/lib/utils';
import Link from 'next/link';
import { Building2, Cpu, Zap } from 'lucide-react';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;

  let factoriesList;
  try {
    factoriesList = await serverApi.factories();
  } catch {
    factoriesList = { factories: [] };
  }

  const earliestOnboard = factoriesList.factories.reduce<string | null>((earliest, f) => {
    if (!f.created_at) return earliest;
    if (!earliest || f.created_at < earliest) return f.created_at;
    return earliest;
  }, null);

  const range = resolveDateRange(sp, earliestOnboard);
  const rangeLabel = formatRangeLabel(range.from, range.to);

  let overview;
  try {
    overview = await serverApi.overview(range);
  } catch (err) {
    return (
      <>
        <PageHeader title="Platform Overview" description="Cross-factory operational summary" />
        <div className="p-4 sm:p-6 lg:p-8">
          <ErrorState message={`Unable to load overview. Ensure the query API is running on port 8001. (${err instanceof Error ? err.message : 'Unknown error'})`} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Platform Overview"
        description={`Operational summary across all connected factories · ${rangeLabel}`}
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <DateRangeToolbar minDate={earliestOnboard} from={sp.from} to={sp.to} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Factories" value={String(overview.factory_count)} icon={<Building2 className="h-4 w-4 text-muted" />} />
          <StatCard label="Total Machines" value={String(overview.total_machines)} icon={<Cpu className="h-4 w-4 text-muted" />} />
          <StatCard
            label="Avg Availability"
            value={formatPercent(
              overview.factories.reduce((s, f) => s + (f.avg_availability_percent ?? 0), 0) /
                Math.max(overview.factories.filter((f) => f.avg_availability_percent !== null).length, 1),
            )}
          />
          <StatCard
            label={`Total Energy (${rangeLabel})`}
            value={`${formatNumber(overview.factories.reduce((s, f) => s + f.total_energy_kwh, 0))} kWh`}
            icon={<Zap className="h-4 w-4 text-muted" />}
          />
        </div>

        <Card>
          <CardHeader title="Factory Performance" description="Click a factory to view detailed metrics" />
          <div className="grid gap-4 md:grid-cols-2">
            {overview.factories.map((f) => (
              <Link
                key={f.factory_id}
                href={`/factories/${f.factory_id}`}
                className="rounded-lg border p-4 transition-colors hover:border-primary hover:bg-blue-50/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{f.name}</h4>
                    <p className="text-sm text-muted">{f.location ?? f.factory_id}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{f.tier}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted">Availability</p>
                    <p className="font-semibold">{formatPercent(f.avg_availability_percent)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Energy</p>
                    <p className="font-semibold">{formatNumber(f.total_energy_kwh)} kWh</p>
                  </div>
                  <div>
                    <p className="text-muted">Units</p>
                    <p className="font-semibold">{f.total_units}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
