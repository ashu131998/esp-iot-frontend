'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { DEFAULT_SHIFTS } from '@/lib/shifts';
import type {
  CreateScheduleInput,
  Machine,
  MachineConfigProfile,
  ProductionLine,
  Worker,
} from '@/lib/types';

/** Common floor tasks operators are scheduled for. */
const TASK_PRESETS = [
  'Operate looms',
  'Loom setup / warp change',
  'Preventive maintenance',
  'Quality inspection',
  'Breakdown repair',
  'Material loading',
  'Shift supervision',
];

const shiftTimes: Record<string, { start: string; end: string }> = {
  A: { start: '06:00', end: '18:00' },
  B: { start: '18:00', end: '06:00' },
};

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Every date (YYYY-MM-DD) from start to end inclusive. */
function datesInRange(start: string, end: string): string[] {
  if (!start) return [];
  if (!end || end < start) return [start];
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function ScheduleForm({
  factoryId,
  workers,
  machines,
  lines,
  profiles,
}: {
  factoryId: string;
  workers: Worker[];
  machines: Machine[];
  lines: ProductionLine[];
  profiles: MachineConfigProfile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const emptyForm = useMemo<CreateScheduleInput>(
    () => ({
      worker_id: workers[0]?.worker_id ?? '',
      task: TASK_PRESETS[0],
      shift_id: 'A',
      schedule_date: todayKey(),
      start_time: shiftTimes.A.start,
      end_time: shiftTimes.A.end,
      machine_ids: [],
      config_profile_id: '',
      notes: '',
    }),
    [workers],
  );

  const [form, setForm] = useState<CreateScheduleInput>(emptyForm);
  const [endDate, setEndDate] = useState<string>(todayKey());

  const scheduleDates = useMemo(
    () => datesInRange(form.schedule_date, endDate),
    [form.schedule_date, endDate],
  );

  const machinesByLine = useMemo(() => {
    const groups = new Map<string, Machine[]>();
    for (const m of machines) {
      if (!groups.has(m.line_id)) groups.set(m.line_id, []);
      groups.get(m.line_id)!.push(m);
    }
    return groups;
  }, [machines]);

  const lineName = (lineId: string) =>
    lines.find((l) => l.line_id === lineId)?.name ?? lineId;

  function toggleMachine(machineId: string) {
    setForm((f) => {
      const set = new Set(f.machine_ids ?? []);
      if (set.has(machineId)) set.delete(machineId);
      else set.add(machineId);
      return { ...f, machine_ids: [...set] };
    });
  }

  function onShiftChange(shiftId: string) {
    const times = shiftTimes[shiftId];
    setForm((f) => ({
      ...f,
      shift_id: shiftId,
      start_time: times?.start ?? f.start_time,
      end_time: times?.end ?? f.end_time,
    }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const profile = profiles.find((p) => p.profile_id === form.config_profile_id);
      const base = {
        worker_id: form.worker_id,
        task: form.task,
        shift_id: form.shift_id,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        machine_ids: form.machine_ids ?? [],
        config_profile_id: form.config_profile_id || null,
        config_profile_name: profile?.name ?? null,
        notes: form.notes,
      };
      // One schedule entry per day in the selected range.
      return Promise.all(
        scheduleDates.map((schedule_date) =>
          api.createSchedule(factoryId, { ...base, schedule_date }),
        ),
      );
    },
    onSuccess: () => {
      router.refresh();
      setOpen(false);
      setForm(emptyForm);
      setEndDate(todayKey());
    },
  });

  const canSave =
    Boolean(form.worker_id) &&
    Boolean(form.task) &&
    scheduleDates.length > 0 &&
    (form.machine_ids?.length ?? 0) > 0;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Schedule Task
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-semibold">Schedule a Task</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Worker">
          <Select
            value={form.worker_id}
            onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
          >
            {workers.length === 0 && <option value="">No workers — add one first</option>}
            {workers.map((w) => (
              <option key={w.worker_id} value={w.worker_id}>
                {w.name} — {w.role}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Function / Task">
          <Input
            list="task-presets"
            placeholder="e.g. Operate looms"
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
          />
          <datalist id="task-presets">
            {TASK_PRESETS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        <Field label="Shift">
          <Select value={form.shift_id} onChange={(e) => onShiftChange(e.target.value)}>
            {DEFAULT_SHIFTS.map((s) => (
              <option key={s.shift_id} value={s.shift_id}>
                {s.name} ({s.label})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Start Date">
          <Input
            type="date"
            value={form.schedule_date}
            onChange={(e) => {
              const start = e.target.value;
              setForm({ ...form, schedule_date: start });
              // Keep the end date from falling behind the start.
              if (start && (!endDate || endDate < start)) setEndDate(start);
            }}
          />
        </Field>

        <Field label="End Date">
          <Input
            type="date"
            min={form.schedule_date || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {scheduleDates.length > 1 && (
            <p className="mt-1 text-xs text-muted">
              {scheduleDates.length} days — one task per day will be created.
            </p>
          )}
        </Field>

        <Field label="Start Time">
          <Input
            type="time"
            value={form.start_time ?? ''}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </Field>

        <Field label="End Time">
          <Input
            type="time"
            value={form.end_time ?? ''}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label={`Looms / Machines${(form.machine_ids?.length ?? 0) > 0 ? ` (${form.machine_ids!.length} selected)` : ''}`}>
            <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border bg-white p-3">
              {[...machinesByLine.entries()].map(([lineId, lineMachines]) => (
                <div key={lineId}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    {lineName(lineId)}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {lineMachines.map((m) => {
                      const checked = form.machine_ids?.includes(m.machine_id) ?? false;
                      return (
                        <label
                          key={m.machine_id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMachine(m.machine_id)}
                          />
                          <span className="truncate">{m.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {machines.length === 0 && (
                <p className="text-sm text-muted">No machines available.</p>
              )}
            </div>
          </Field>
        </div>

        <Field label="Machine Configuration Profile">
          <Select
            value={form.config_profile_id ?? ''}
            onChange={(e) => setForm({ ...form, config_profile_id: e.target.value })}
          >
            <option value="">— None —</option>
            {profiles.map((p) => {
              const machine = machines.find((m) => m.machine_id === p.machine_id);
              return (
                <option key={p.profile_id} value={p.profile_id}>
                  {p.name}
                  {machine ? ` · ${machine.name}` : ''}
                </option>
              );
            })}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea
              rows={2}
              placeholder="Optional instructions for this assignment"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending
            ? 'Scheduling…'
            : scheduleDates.length > 1
              ? `Save Schedule (${scheduleDates.length} days)`
              : 'Save Schedule'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {!canSave && (
          <p className="self-center text-xs text-muted">
            Pick a worker, a task, a date, and at least one loom.
          </p>
        )}
        {mutation.isError && (
          <p className="self-center text-sm text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
