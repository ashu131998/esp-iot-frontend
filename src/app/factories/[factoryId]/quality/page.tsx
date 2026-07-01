import { Suspense } from 'react';

import { QualityPanel } from '@/components/factory/quality-panel';
import { DateRangeToolbar } from '@/components/ui/date-range-toolbar';
import { NavDim } from '@/lib/navigation-context';
import { formatRangeLabel, resolveDateRange } from '@/lib/date-range';
import { resolvePagination, resolveListTotal } from '@/lib/pagination';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

async function QualityContent({
  factoryId,
  from,
  to,
  page,
  limit,
  machineId,
}: {
  factoryId: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
  machineId?: string;
}) {
  const factory = await serverApi.factory(factoryId);
  const { machines } = await serverApi.machines(factoryId);
  const range = resolveDateRange({ from, to }, factory.created_at);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const pagination = resolvePagination({ page, limit });
  const data = await serverApi.quality(
    factoryId,
    range.from,
    range.to,
    pagination.limit,
    pagination.offset,
    machineId,
  );

  return (
    <QualityPanel
      factoryId={factoryId}
      machines={machines}
      records={data.records ?? []}
      from={range.from}
      to={range.to}
      rangeLabel={rangeLabel}
      total={resolveListTotal(
        data.total,
        data.records?.length ?? 0,
        pagination.limit,
        pagination.offset,
      )}
      page={pagination.page}
      limit={pagination.limit}
    />
  );
}

export default async function QualityPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string; limit?: string; machine_id?: string }>;
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
            page={sp.page}
            limit={sp.limit}
            machineId={sp.machine_id}
          />
        </Suspense>
      </NavDim>
    </div>
  );
}
