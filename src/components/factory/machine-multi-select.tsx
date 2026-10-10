'use client';

import { useMemo } from 'react';

import type { Machine, ProductionLine } from '@/lib/types';
import { cn } from '@/lib/utils';

export function MachineMultiSelect({
  machines,
  lines,
  selectedIds,
  onChange,
  lockedIds = [],
  className,
}: {
  machines: Machine[];
  lines?: ProductionLine[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Cannot be unchecked (e.g. profile’s home machine when editing). */
  lockedIds?: string[];
  className?: string;
}) {
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const machinesByLine = useMemo(() => {
    const groups = new Map<string, Machine[]>();
    for (const m of machines) {
      if (!groups.has(m.line_id)) groups.set(m.line_id, []);
      groups.get(m.line_id)!.push(m);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [machines]);

  const lineName = (lineId: string) =>
    lines?.find((l) => l.line_id === lineId)?.name ?? lineId;

  function toggle(machineId: string) {
    if (locked.has(machineId)) return;
    const set = new Set(selectedIds);
    if (set.has(machineId)) set.delete(machineId);
    else set.add(machineId);
    onChange([...set]);
  }

  function selectAll() {
    onChange(machines.map((m) => m.machine_id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted">
          {selectedIds.length} selected
        </span>
        <button type="button" className="text-primary hover:underline" onClick={selectAll}>
          Select all
        </button>
        <span className="text-muted">·</span>
        <button type="button" className="text-muted hover:underline" onClick={clearAll}>
          Clear
        </button>
      </div>
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border bg-white p-3">
        {[...machinesByLine.entries()].map(([lineId, lineMachines]) => (
          <div key={lineId}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {lineName(lineId)}
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {lineMachines.map((m) => {
                const checked = selectedIds.includes(m.machine_id);
                return (
                  <label
                    key={m.machine_id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-slate-50',
                      checked && 'border-primary/40 bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked.has(m.machine_id)}
                      onChange={() => toggle(m.machine_id)}
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {machines.length === 0 && (
          <p className="text-center text-sm text-muted">No machines in this factory.</p>
        )}
      </div>
    </div>
  );
}
