import { Suspense } from 'react';

import { QualityPanel } from '@/components/factory/quality-panel';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';
import { resolveDateRange } from '@/lib/date-range';
import { SCROLL_STEP } from '@/lib/infinite';
import { resolveListTotal } from '@/lib/pagination';
import { serverApi } from '@/lib/server-api';
import { factoryPage } from '@/lib/server/factory-page';

export const dynamic = 'force-dynamic';

async function QualityContent({
  factoryId,
  from,
  to,
  machineId,
  lineId,
}: {
  factoryId: string;
  from?: string;
  to?: string;
  machineId?: string;
  lineId?: string;
}) {
  const factory = await serverApi.factory(factoryId);
  const { machines: allMachines } = await serverApi.machines(factoryId);
  const machines = lineId
    ? allMachines.filter((m) => m.line_id === lineId)
    : machineId
      ? allMachines.filter((m) => m.machine_id === machineId)
      : allMachines;
  const range = resolveDateRange({ from, to }, factory.created_at, factory.shifts);
  // The first records; the panel loads more as the list scrolls (infinite scroll).
  const data = await serverApi.quality(factoryId, range.from, range.to, SCROLL_STEP, 0, machineId, lineId);
  const records = data.records ?? [];

  return (
    <QualityPanel
      factoryId={factoryId}
      machines={machines}
      first={{ items: records, total: resolveListTotal(data.total, records.length, SCROLL_STEP, 0) }}
      from={range.from}
      to={range.to}
      machineId={machineId}
      lineId={lineId}
    />
  );
}

async function QualityPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; machine_id?: string; line_id?: string }>;
}) {
  const { factoryId } = await params;
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <DateRangeToolbar />
      </div>
      <NavDim>
        <Suspense fallback={<div className="space-y-4 px-4 sm:px-6 lg:px-8"><div className="h-20 bg-gray-100 rounded animate-pulse" /></div>}>
          <QualityContent
            factoryId={factoryId}
            from={sp.from}
            to={sp.to}
            machineId={sp.machine_id}
            lineId={sp.line_id}
          />
        </Suspense>
      </NavDim>
    </div>
  );
}

export default factoryPage('quality', QualityPage);
