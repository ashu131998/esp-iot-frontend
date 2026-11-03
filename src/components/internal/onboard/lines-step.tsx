'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { PHONE_HIDDEN, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  bulkMachines, lineProblems, machineProblems, newLine, newMachine, suggestFactoryId, type LineDraft, type MachineDraft,
} from '@/lib/onboarding';
import { cn } from '@/lib/utils';

/**
 * The factory's production lines and its machines. Optional: both can be added later on the
 * factory's Setup page. Machines can be added in a run ("Loom #1" to "Loom #40") and then
 * edited one by one.
 */
export function LinesStep({
  lines, machines, onChange, tried,
}: {
  lines: LineDraft[];
  machines: MachineDraft[];
  onChange: (next: { lines: LineDraft[]; machines: MachineDraft[] }) => void;
  tried: boolean;
}) {
  const [run, setRun] = useState({ prefix: 'Loom #', from: '1', to: '12', line_key: '', type: '', target_units_per_hour: '' });
  const lp = lineProblems(lines);
  const mp = machineProblems(machines, lines);
  const runLine = lines.some((l) => l.key === run.line_key) ? run.line_key : (lines[0]?.key ?? '');
  const runMachines = bulkMachines({
    prefix: run.prefix, from: Number(run.from), to: Number(run.to), line_key: runLine, type: run.type.trim(),
    target_units_per_hour: run.target_units_per_hour.trim(),
  }, machines);

  const setLine = (k: string, patch: Partial<LineDraft>) => onChange({ lines: lines.map((l) => (l.key === k ? { ...l, ...patch } : l)), machines });
  const removeLine = (k: string) => onChange({ lines: lines.filter((l) => l.key !== k), machines: machines.filter((m) => m.line_key !== k) });
  const setMachine = (k: string, patch: Partial<MachineDraft>) => onChange({ lines, machines: machines.map((m) => (m.key === k ? { ...m, ...patch } : m)) });
  const lineName = (l: LineDraft, i: number) => l.name.trim() || l.line_id.trim() || `Line ${i + 1}`;

  return (
    <>
      <CardHeader
        title="Lines & machines"
        description="Optional: both can be added later on the factory's Setup page. A machine belongs to a line, so add the lines first."
      />

      <h4 className="text-sm font-semibold">Lines</h4>
      <div className="mt-2 space-y-2">
        {lines.map((l, i) => (
          <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_12rem_auto] sm:items-start sm:border-0 sm:p-0">
            <Input
              aria-label="Line name"
              value={l.name}
              placeholder={`Line ${i + 1}, e.g. Weaving A`}
              onChange={(e) => setLine(l.key, { name: e.target.value, ...(l.idEdited ? {} : { line_id: suggestFactoryId(e.target.value) }) })}
            />
            <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
              <Input
                aria-label="Line ID"
                value={l.line_id}
                placeholder="line-1"
                className="font-mono"
                onChange={(e) => setLine(l.key, { line_id: e.target.value, idEdited: true })}
              />
              {(tried || l.line_id) && lp[i].line_id && <p className="text-xs text-red-600">{lp[i].line_id}</p>}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove ${lineName(l, i)}`}
              onClick={() => removeLine(l.key)}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={() => onChange({ lines: [...lines, newLine(`line-${lines.length + 1}`, `Line ${lines.length + 1}`)], machines })}
      >
        + Add line
      </Button>
      {lines.length > 0 && machines.some((m) => !lines.some((l) => l.key === m.line_key)) && (
        <p className="mt-1 text-xs text-amber-700">Some machines lost their line: pick one for each below.</p>
      )}

      {lines.length > 0 && (
        <div className="mt-6 rounded-lg border bg-slate-50 p-3">
          <h4 className="text-sm font-semibold">Add machines in one go</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Field label="Name">
              <Input value={run.prefix} onChange={(e) => setRun({ ...run, prefix: e.target.value })} />
            </Field>
            <Field label="From">
              <Input inputMode="numeric" value={run.from} onChange={(e) => setRun({ ...run, from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input inputMode="numeric" value={run.to} onChange={(e) => setRun({ ...run, to: e.target.value })} />
            </Field>
            <Field label="Line">
              <Select value={runLine} onChange={(e) => setRun({ ...run, line_key: e.target.value })}>
                {lines.map((l, i) => <option key={l.key} value={l.key}>{lineName(l, i)}</option>)}
              </Select>
            </Field>
            <Field label="Type">
              <Input value={run.type} placeholder="rapier" onChange={(e) => setRun({ ...run, type: e.target.value })} />
            </Field>
            <Field label="Units / hour">
              <Input inputMode="decimal" value={run.target_units_per_hour} placeholder="12" onChange={(e) => setRun({ ...run, target_units_per_hour: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={runMachines.length === 0}
              onClick={() => onChange({ lines, machines: [...machines, ...runMachines] })}
            >
              {runMachines.length === 0 ? 'Nothing new to add' : `Add ${runMachines.length} machine${runMachines.length === 1 ? '' : 's'}`}
            </Button>
            {runMachines.length > 0 && (
              <span className="text-xs text-muted">
                {runMachines[0].name}{runMachines.length > 1 ? ` … ${runMachines[runMachines.length - 1].name}` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {machines.length > 0 && (
        <>
          <h4 className="mt-6 text-sm font-semibold">Machines ({machines.length})</h4>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Line</TH>
                  <TH className={PHONE_HIDDEN}>Type</TH>
                  <TH className={PHONE_HIDDEN}>Units / h</TH>
                  <TH className={PHONE_HIDDEN}>Cycle (s)</TH>
                  <TH className={PHONE_HIDDEN}>Volts</TH>
                  <TH className={PHONE_HIDDEN}>Unit</TH>
                  <TH className={PHONE_HIDDEN}>Machine ID</TH>
                  <TH>{' '}</TH>
                </TR>
              </THead>
              <TBody>
                {machines.map((m, i) => {
                  const p = mp[i];
                  const problem = p.name ?? p.line_key ?? p.machine_id ?? p.numbers;
                  return (
                    <TR key={m.key}>
                      <TD className="min-w-[8rem]">
                        <Input aria-label="Machine name" value={m.name} onChange={(e) => setMachine(m.key, { name: e.target.value })} />
                        {tried && problem && <p className="text-xs text-red-600">{problem}</p>}
                      </TD>
                      <TD className="min-w-[7rem]">
                        <Select
                          aria-label="Line"
                          value={lines.some((l) => l.key === m.line_key) ? m.line_key : ''}
                          className={cn(!lines.some((l) => l.key === m.line_key) && 'border-amber-400')}
                          onChange={(e) => setMachine(m.key, { line_key: e.target.value })}
                        >
                          <option value="" disabled>Pick…</option>
                          {lines.map((l, j) => <option key={l.key} value={l.key}>{lineName(l, j)}</option>)}
                        </Select>
                      </TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Type" value={m.type} onChange={(e) => setMachine(m.key, { type: e.target.value })} /></TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Units per hour" inputMode="decimal" value={m.target_units_per_hour} onChange={(e) => setMachine(m.key, { target_units_per_hour: e.target.value })} /></TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Cycle seconds" inputMode="decimal" value={m.target_cycle_time_sec} onChange={(e) => setMachine(m.key, { target_cycle_time_sec: e.target.value })} /></TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Volts" inputMode="decimal" value={m.voltage_v} placeholder="230" onChange={(e) => setMachine(m.key, { voltage_v: e.target.value })} /></TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Unit" value={m.unit_label} maxLength={16} placeholder="m" onChange={(e) => setMachine(m.key, { unit_label: e.target.value })} /></TD>
                      <TD className={PHONE_HIDDEN}><Input aria-label="Machine ID" value={m.machine_id} placeholder="auto" className="font-mono" onChange={(e) => setMachine(m.key, { machine_id: e.target.value })} /></TD>
                      <TD>
                        <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${m.name || 'machine'}`} onClick={() => onChange({ lines, machines: machines.filter((x) => x.key !== m.key) })}>
                          ✕
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </>
      )}
      {lines.length > 0 && (
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onChange({ lines, machines: [...machines, newMachine(lines[lines.length - 1].key)] })}>
          + Add one machine
        </Button>
      )}
    </>
  );
}
