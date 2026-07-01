'use client';

import { useSearchParams } from 'next/navigation';

import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import type { Machine, ProductionLine } from '@/lib/types';

/**
 * Thin client wrapper around the date picker. It reads the current range/machine
 * from the URL (so the label updates instantly on navigation) and, on factory
 * pages, sources machines/lines/minDate from the once-fetched factory refs
 * context. All props remain optional overrides for non-factory pages (overview)
 * or pages that need a filtered machine list (e.g. a single line).
 */
export function DateRangeToolbar({
  minDate,
  className,
  from,
  to,
  machines,
  lines,
  selectedMachineId,
  hideDateRange = false,
  hideMachineSelector = false,
}: {
  minDate?: string | null;
  className?: string;
  from?: string;
  to?: string;
  machines?: Machine[];
  lines?: ProductionLine[];
  selectedMachineId?: string;
  hideDateRange?: boolean;
  hideMachineSelector?: boolean;
}) {
  const sp = useSearchParams();
  const refs = useFactoryRefsOptional();

  return (
    <DateRangePicker
      minDate={minDate ?? refs?.minDate ?? null}
      className={className}
      from={sp.get('from') ?? from ?? undefined}
      to={sp.get('to') ?? to ?? undefined}
      machineId={sp.get('machine_id') ?? selectedMachineId ?? undefined}
      machines={hideMachineSelector ? undefined : machines ?? refs?.machines}
      lines={lines ?? refs?.lines}
      hideDateRange={hideDateRange}
    />
  );
}
