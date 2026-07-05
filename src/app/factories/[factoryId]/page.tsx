import { Suspense } from 'react';
import Link from 'next/link';

import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { StatCard, LiveStatusBadge } from '@/components/ui/badge';
import { MiniTimeline } from '@/components/ui/mini-timeline';
import { Card, CardHeader } from '@/components/ui/card';
import { ExportCsvButton } from '@/components/ui/export-csv-button';
import { TBody, TD, THead, TH, TR, Table } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { NavDim } from '@/lib/navigation-context';
import { formatRangeLabel } from '@/lib/date-range';
import { resolveDateRange } from '@/lib/date-range';
import { resolvePagination } from '@/lib/pagination';
import { serverApi } from '@/lib/server-api';
import { formatNumber, formatPercent, statusLabel } from '@/lib/utils';
import { Activity, Package, Zap } from 'lucide-react';

export default async function FactoryOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;
  const { page, limit, offset } = resolvePagination({ page: sp.page, limit: sp.limit });

  const factory = await serverApi.factory(factoryId);
  const range = resolveDateRange(sp, factory.created_at);
  const rangeLabel = formatRangeLabel(range.from, range.to);

  const now = new Date();
  const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const total = factory.machines.length;
  const pageMachineIds = factory.machines
    .slice(offset, offset + limit)
    .map((m) => m.machine_id);

  const [availability, energy, production, uptime24h] = await Promise.all([
    serverApi.availability(factoryId, range),
    serverApi.energy(factoryId, range),
    serverApi.production(factoryId, range),
    pageMachineIds.length > 0
      ? serverApi.uptime(factoryId, {
          from: from24h,
          to: now.toISOString(),
          machine_ids: pageMachineIds.join(','),
        })
      : Promise.resolve({ machines: [] }),
  ]);

  const windowHours = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 3600000;
  const targetUnits = factory.machines.reduce(
    (s, m) => s + (m.target_units_per_hour ?? 0) * windowHours,
    0,
  );
  const throughputPct = targetUnits > 0 ? Math.min(100, (production.total_units / targetUnits) * 100) : 0;
  const performancePct =
    Math.round(
      ((availability.avg_availability_percent ?? 0) / 100) * (throughputPct / 100) * 1000,
    ) / 10;

  const uptimeByMachine = Object.fromEntries(uptime24h.machines.map((m) => [m.machine_id, m]));

  const machineRows = factory.machines.map((m) => {
    const avail = availability.machines.find((a) => a.machine_id === m.machine_id);
    const eng = energy.machines.find((e) => e.machine_id === m.machine_id);
    const prod = production.machines.find((p) => p.machine_id === m.machine_id);
    const uptime = uptimeByMachine[m.machine_id];
    return { machine: m, avail, eng, prod, uptime };
  });

  const pageRows = machineRows.slice(offset, offset + limit);

  function currentStatus(uptime?: (typeof uptime24h.machines)[0], avail?: (typeof availability.machines)[0]) {
    return statusLabel(uptime?.timeline.at(-1)?.status ?? avail?.status ?? 'no_data');
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <DateRangeToolbar minDate={factory.created_at} from={sp.from} to={sp.to} />

      <NavDim className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Availability (${rangeLabel})`}
          value={formatPercent(availability.avg_availability_percent)}
          icon={<Activity className="h-4 w-4 text-muted" />}
        />
        <StatCard
          label={`Energy (${rangeLabel})`}
          value={`${formatNumber(energy.total_energy_kwh)} kWh`}
          icon={<Zap className="h-4 w-4 text-muted" />}
        />
        <StatCard label="Units Produced" value={String(production.total_units)} icon={<Package className="h-4 w-4 text-muted" />} />
        <StatCard label="Performance" value={formatPercent(performancePct)} />
      </div>

      <Card>
        <CardHeader
          title="Machines"
          description={`All machines registered for this factory · ${rangeLabel}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton
                filename="factory-machines"
                headers={['Machine', 'Line', 'Type', 'Availability', 'Energy (kWh)', 'Units', 'Current Status']}
                rows={machineRows.map(({ machine, avail, eng, prod, uptime }) => [
                  machine.name,
                  machine.line_id,
                  machine.type,
                  avail?.availability_percent,
                  eng?.energy_kwh,
                  prod?.units_produced ?? 0,
                  currentStatus(uptime, avail),
                ])}
              />
              <Link href={`/factories/${factoryId}/configuration`} className="text-sm text-primary hover:underline">
                Manage config →
              </Link>
            </div>
          }
        />
        <Table>
          <THead>
            <TR>
              <TH>Machine</TH>
              <TH>Line</TH>
              <TH>Type</TH>
              <TH>Availability</TH>
              <TH>Energy</TH>
              <TH>Units</TH>
              <TH>Last 24h</TH>
              <TH>Current Status</TH>
            </TR>
          </THead>
          <TBody>
            {pageRows.map(({ machine, avail, eng, prod, uptime }) => (
              <TR key={machine.machine_id}>
                <TD className="font-medium">{machine.name}</TD>
                <TD>{machine.line_id}</TD>
                <TD className="capitalize">{machine.type}</TD>
                <TD>{formatPercent(avail?.availability_percent)}</TD>
                <TD>{eng?.energy_kwh != null ? `${formatNumber(eng.energy_kwh)} kWh` : '—'}</TD>
                <TD>{prod?.units_produced ?? 0}</TD>
                <TD>
                  <MiniTimeline segments={uptime?.timeline ?? []} />
                </TD>
                <TD>
                  <LiveStatusBadge status={uptime?.timeline.at(-1)?.status ?? avail?.status ?? 'no_data'} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Suspense>
          <TablePagination total={total} page={page} limit={limit} />
        </Suspense>
      </Card>
      </NavDim>
    </div>
  );
}
