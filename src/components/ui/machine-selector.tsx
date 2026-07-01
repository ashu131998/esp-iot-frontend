'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, ChevronDown, X } from 'lucide-react';

import type { Machine, ProductionLine } from '@/lib/types';
import { cn } from '@/lib/utils';

export const MACHINE_PARAM = 'machine_id';

export function MachineSelector({
  machines,
  lines,
  selectedMachineId,
  from,
  to,
}: {
  machines: Machine[];
  lines: ProductionLine[];
  selectedMachineId?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const lineMap = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.line_id, l.name])),
    [lines],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.machine_id === selectedMachineId),
    [machines, selectedMachineId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? machines.filter((m) => m.name.toLowerCase().includes(q)) : machines;
  }, [machines, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Machine[]> = {};
    for (const m of filtered) {
      if (!groups[m.line_id]) groups[m.line_id] = [];
      groups[m.line_id].push(m);
    }
    return groups;
  }, [filtered]);

  const navigate = useCallback(
    (machineId: string | undefined) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (machineId) params.set(MACHINE_PARAM, machineId);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
      setOpen(false);
      setSearch('');
    },
    [router, pathname, from, to],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs shadow-sm transition-colors hover:bg-accent',
          isPending && 'opacity-70',
          selectedMachineId && 'border-primary/50 bg-primary/5 text-primary',
        )}
      >
        <span className="font-medium text-muted mr-1">Machine</span>
        <span className={cn('max-w-[140px] truncate', selectedMachineId ? 'text-primary font-medium' : 'text-foreground')}>
          {selectedMachine ? selectedMachine.name : 'All'}
        </span>
        {selectedMachineId ? (
          <span
            role="button"
            aria-label="Clear machine filter"
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              navigate(undefined);
            }}
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3 w-3 text-muted" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg">
            <div className="p-2 border-b">
              <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search machines…"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => navigate(undefined)}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors',
                  !selectedMachineId && 'bg-accent font-medium',
                )}
              >
                All Machines
              </button>

              {Object.entries(grouped).map(([lineId, lineMs]) => (
                <div key={lineId}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {lineMap[lineId] ?? lineId}
                  </p>
                  {lineMs.map((m) => (
                    <button
                      key={m.machine_id}
                      type="button"
                      onClick={() => navigate(m.machine_id)}
                      className={cn(
                        'w-full px-5 py-1.5 text-left text-xs hover:bg-accent transition-colors',
                        m.machine_id === selectedMachineId && 'bg-accent font-medium',
                      )}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              ))}

              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted">No machines found</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
