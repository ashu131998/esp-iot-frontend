import { notFound } from 'next/navigation';

import { FactoryShell } from '@/components/layout/factory-shell';
import { serverApi } from '@/lib/server-api';
import { getFactoryConfig } from '@/lib/factory-config';
import { displayOf, factoryTabs } from '@/lib/display';
import { sortByMachineName } from '@/lib/machine-sort';
import { DEFAULT_SHIFTS } from '@/lib/shifts';

export async function FactoryShellLoader({
  factoryId,
  children,
}: {
  factoryId: string;
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

  // Pages and sections our staff switched for this factory (lib/display.ts).
  const display = displayOf(factory);

  return (
    <FactoryShell
      factoryId={factoryId}
      factoryName={factory.name ?? config.name}
      location={factory.location}
      shifts={shifts}
      tabs={factoryTabs(factoryId, display)}
      description={`${factory.location ?? ''} · ${factory.machines?.length ?? 0} machines · ${shiftLabel}`}
      refs={{
        machines: sortByMachineName(factory.machines ?? []),
        lines: lines ?? [],
        minDate: factory.created_at,
        shifts,
        display,
      }}
    >
      {children}
    </FactoryShell>
  );
}
