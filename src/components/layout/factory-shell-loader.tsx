import { notFound } from 'next/navigation';

import { FactoryShell } from '@/components/layout/factory-shell';
import { serverApi } from '@/lib/server-api';
import { getFactoryConfig } from '@/lib/factory-config';
import { DEFAULT_SHIFTS } from '@/lib/shifts';

export async function FactoryShellLoader({
  factoryId,
  tabs,
  children,
}: {
  factoryId: string;
  tabs: Array<{ slug: string; label: string; href: string }>;
  children: React.ReactNode;
}) {
  const config = getFactoryConfig(factoryId);

  let factory;
  let lines;
  try {
    // Reference data fetched once here; the layout persists across page
    // navigations, so the date toolbar never re-fetches it on a date change.
    [factory, { lines }] = await Promise.all([
      serverApi.factory(factoryId),
      serverApi.lines(factoryId),
    ]);
  } catch {
    notFound();
  }

  const shifts = factory.shifts?.length ? factory.shifts : DEFAULT_SHIFTS;
  const shiftLabel = shifts.map((s) => s.label).join(' · ');

  return (
    <FactoryShell
      factoryId={factoryId}
      factoryName={factory.name ?? config.name}
      location={factory.location}
      shifts={shifts}
      tabs={tabs}
      description={`${factory.location ?? ''} · ${factory.machines?.length ?? 0} machines · ${shiftLabel}`}
      refs={{
        machines: factory.machines ?? [],
        lines: lines ?? [],
        minDate: factory.created_at,
      }}
    >
      {children}
    </FactoryShell>
  );
}
