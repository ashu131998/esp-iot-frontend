'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Calendar, ChevronDown, Loader2, Search, X } from 'lucide-react';

import { ScheduleForm } from '@/components/factory/schedule-form';
import { WorkerRoster } from '@/components/factory/worker-roster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { StatCard } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { api } from '@/lib/api';
import { useNavigate, useIsNavigating } from '@/lib/navigation-context';
import { DEFAULT_SHIFTS } from '@/lib/shifts';
import { cn } from '@/lib/utils';
import type {
  Machine,
  MachineConfigProfile,
  ProductionLine,
  Worker,
  WorkerSchedule,
} from '@/lib/types';

const STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const statusStyle: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

/** "in_progress" -> "In Progress" */
function formatStatus(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d);
}

/** Normalize a schedule_date to "YYYY-MM-DD" (IST) for comparing with the date URL param. */
function toDateKey(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// ── Scheduling filter toolbar ─────────────────────────────────────────────────
// Matches the visual style of DateRangePicker (same container, same machine
// dropdown with search + line grouping). Uses URL params so the browser back
// button restores the filter and refreshes work correctly.

function SchedulingFilterBar({
  machines,
  lines,
}: {
  machines: Machine[];
  lines: ProductionLine[];
}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const navigate = useNavigate();
  const isNavigating = useIsNavigating();

  const dateFilter = sp.get('date') ?? '';
  const machineId = sp.get('machine_id') ?? '';

  const [machineOpen, setMachineOpen] = useState(false);
  const [machineSearch, setMachineSearch] = useState('');

  const lineMap = useMemo(
    () => Object.fromEntries((lines ?? []).map((l) => [l.line_id, l.name])),
    [lines],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.machine_id === machineId),
    [machines, machineId],
  );

  const filteredMachines = useMemo(() => {
    const q = machineSearch.toLowerCase().trim();
    return q ? machines.filter((m) => m.name.toLowerCase().includes(q)) : machines;
  }, [machines, machineSearch]);

  const groupedMachines = useMemo(() => {
    const groups: Record<string, Machine[]> = {};
    for (const m of filteredMachines) {
      if (!groups[m.line_id]) groups[m.line_id] = [];
      groups[m.line_id].push(m);
    }
    return groups;
  }, [filteredMachines]);

  const push = useCallback(
    (params: URLSearchParams) => {
      const s = params.toString();
      navigate(s ? `${pathname}?${s}` : pathname);
    },
    [navigate, pathname],
  );

  function applyDate(date: string) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (machineId) params.set('machine_id', machineId);
    push(params);
  }

  function applyMachine(id: string | undefined) {
    const params = new URLSearchParams();
    if (dateFilter) params.set('date', dateFilter);
    if (id) params.set('machine_id', id);
    push(params);
    setMachineOpen(false);
    setMachineSearch('');
  }

  function clearAll() {
    push(new URLSearchParams());
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">

      {/* Date trigger — styled like the DateRangePicker calendar button */}
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 hover:border-gray-300">
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => applyDate(e.target.value)}
          className="bg-transparent text-sm font-medium text-foreground outline-none [color-scheme:light]"
        />
        {dateFilter && (
          <button
            type="button"
            aria-label="Clear date filter"
            onClick={() => applyDate('')}
            className="ml-0.5 rounded-full p-0.5 hover:bg-gray-200"
          >
            <X className="h-3.5 w-3.5 text-muted" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

      {/* Machine selector — same pattern as DateRangePicker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMachineOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
            'border-input bg-background hover:bg-accent',
            machineId && 'border-primary/50 bg-primary/5',
          )}
        >
          <span className="font-medium text-muted">Loom</span>
          <span className={cn('max-w-[120px] truncate font-medium', machineId ? 'text-primary' : 'text-foreground')}>
            {selectedMachine ? selectedMachine.name : 'All'}
          </span>
          {machineId ? (
            <span
              role="button"
              aria-label="Clear loom filter"
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); applyMachine(undefined); }}
            >
              <X className="h-3 w-3 text-primary" />
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 text-muted" />
          )}
        </button>

        {machineOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => { setMachineOpen(false); setMachineSearch(''); }}
            />
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border bg-white shadow-lg">
              <div className="border-b p-2">
                <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search looms…"
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => applyMachine(undefined)}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                    !machineId && 'bg-accent font-medium',
                  )}
                >
                  All Looms
                </button>
                {Object.entries(groupedMachines).map(([lineId, lineMs]) => (
                  <div key={lineId}>
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {lineMap[lineId] ?? lineId}
                    </p>
                    {lineMs.map((m) => (
                      <button
                        key={m.machine_id}
                        type="button"
                        onClick={() => applyMachine(m.machine_id)}
                        className={cn(
                          'w-full px-5 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                          m.machine_id === machineId && 'bg-accent font-medium',
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ))}
                {filteredMachines.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted">No looms found</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Updating indicator */}
      {isNavigating && (
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </span>
      )}
    </div>
  );
}

// ── SchedulingPanel ───────────────────────────────────────────────────────────

export function SchedulingPanel({
  factoryId,
  workers,
  machines,
  lines,
  profiles,
  schedules,
}: {
  factoryId: string;
  workers: Worker[];
  machines: Machine[];
  lines: ProductionLine[];
  profiles: MachineConfigProfile[];
  schedules: WorkerSchedule[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const dateFilter = sp.get('date') ?? '';
  const machineFilter = sp.get('machine_id') ?? '';

  const machineName = useMemo(() => {
    const map = new Map(machines.map((m) => [m.machine_id, m.name]));
    return (id: string) => map.get(id) ?? id;
  }, [machines]);

  const shiftName = (shiftId: string) =>
    DEFAULT_SHIFTS.find((s) => s.shift_id === shiftId)?.name ?? `Shift ${shiftId}`;

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (dateFilter && toDateKey(s.schedule_date) !== dateFilter) return false;
      if (machineFilter && !(s.machine_ids ?? []).includes(machineFilter)) return false;
      return true;
    });
  }, [schedules, dateFilter, machineFilter]);

  // Rows with an in-flight delete or status change — dimmed immediately for instant feedback.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // scheduleId -> target status. The row stays dimmed until the refreshed data
  // actually reflects this status, so it never flashes back to the old value.
  const [pendingStatus, setPendingStatus] = useState<Map<string, string>>(new Map());

  const statusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: string; status: string }) =>
      api.updateSchedule(factoryId, scheduleId, { status }),
    onSuccess: () => router.refresh(),
    onError: (err, { scheduleId }) => {
      console.error('Update status failed', err);
      setPendingStatus((prev) => {
        const next = new Map(prev);
        next.delete(scheduleId);
        return next;
      });
    },
  });

  function handleStatusChange(scheduleId: string, status: string) {
    setPendingStatus((prev) => new Map(prev).set(scheduleId, status));
    statusMutation.mutate({ scheduleId, status });
  }

  useEffect(() => {
    setPendingStatus((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, target] of prev) {
        const row = schedules.find((s) => s.schedule_id === id);
        if (!row || row.status === target) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [schedules]);

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => api.deleteSchedule(factoryId, scheduleId),
    onSuccess: () => router.refresh(),
    onError: (err, scheduleId) => {
      console.error('Delete schedule failed', err);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
    },
  });

  function handleDelete(scheduleId: string) {
    setDeletingIds((prev) => new Set(prev).add(scheduleId));
    deleteMutation.mutate(scheduleId);
  }

  useEffect(() => {
    setDeletingIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(schedules.map((s) => s.schedule_id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [schedules]);

  const columns = useMemo<ColumnDef<WorkerSchedule, unknown>[]>(() => [
    {
      id: 'worker',
      accessorFn: (s) => s.worker_name ?? s.worker_id,
      header: 'Worker',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.worker_name ?? row.original.worker_id}
          {row.original.worker_role && (
            <span className="block text-xs font-normal text-muted">{row.original.worker_role}</span>
          )}
        </span>
      ),
    },
    { accessorKey: 'task', header: 'Task' },
    {
      id: 'shift',
      accessorFn: (s) => shiftName(s.shift_id),
      header: 'Shift',
    },
    {
      accessorKey: 'schedule_date',
      header: 'Date',
      cell: ({ row }) => formatDay(row.original.schedule_date),
    },
    {
      id: 'time',
      header: 'Time',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted">
          {row.original.start_time && row.original.end_time
            ? `${row.original.start_time}–${row.original.end_time}`
            : '—'}
        </span>
      ),
    },
    {
      id: 'looms',
      header: 'Looms',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex max-w-[14rem] flex-wrap gap-1">
          {(row.original.machine_ids ?? []).map((id) => (
            <Badge key={id} className="bg-violet-50 text-violet-700">{machineName(id)}</Badge>
          ))}
          {(row.original.machine_ids?.length ?? 0) === 0 && <span className="text-muted">—</span>}
        </div>
      ),
    },
    {
      accessorKey: 'config_profile_name',
      header: 'Config Profile',
      cell: ({ row }) => row.original.config_profile_name ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <>
          <Select
            className="py-1 text-xs"
            value={row.original.status}
            disabled={pendingStatus.has(row.original.schedule_id)}
            onChange={(e) => handleStatusChange(row.original.schedule_id, e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{formatStatus(opt)}</option>
            ))}
          </Select>
          <Badge className={`mt-1 ${statusStyle[row.original.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {formatStatus(row.original.status)}
          </Badge>
        </>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="min-w-[5.5rem] justify-center text-red-600"
          disabled={deletingIds.has(row.original.schedule_id)}
          onClick={() => handleDelete(row.original.schedule_id)}
        >
          {deletingIds.has(row.original.schedule_id) ? 'Deleting' : 'Delete'}
        </Button>
      ),
    },
  ], [machineName, deletingIds, pendingStatus]);

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.status !== 'cancelled' && s.status !== 'completed');
    return {
      total: schedules.length,
      active: active.length,
      dayShift: active.filter((s) => s.shift_id === 'A').length,
      nightShift: active.filter((s) => s.shift_id === 'B').length,
    };
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total assignments" value={String(stats.total)} />
        <StatCard label="Active (open)" value={String(stats.active)} />
        <StatCard label="Day shift" value={String(stats.dayShift)} sub="06:00 – 18:00" />
        <StatCard label="Night shift" value={String(stats.nightShift)} sub="18:00 – 06:00" />
      </div>

      <SchedulingFilterBar machines={machines} lines={lines} />

      <Card>
        <CardHeader
          title="Task Schedule"
          description="Assign each worker a function, shift, date, looms and a machine configuration profile"
          action={
            <ScheduleForm
              factoryId={factoryId}
              workers={workers}
              machines={machines}
              lines={lines}
              profiles={profiles}
            />
          }
        />

        {deleteMutation.isError && (
          <p className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Couldn't delete task: {(deleteMutation.error as Error).message}
          </p>
        )}

        <DataTable
          columns={columns}
          data={filteredSchedules}
          className="border-0"
          rowClassName={(s) =>
            deletingIds.has(s.schedule_id) || pendingStatus.has(s.schedule_id)
              ? 'opacity-40 transition-opacity'
              : undefined
          }
          emptyMessage={
            dateFilter || machineFilter
              ? 'No tasks match the selected filters.'
              : 'No tasks scheduled yet. Use "Schedule Task" to assign a worker.'
          }
        />
      </Card>

      <WorkerRoster factoryId={factoryId} workers={workers} />
    </div>
  );
}
