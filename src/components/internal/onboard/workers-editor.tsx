'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { WORKER_ROLES, generatePassword, newWorker, workerProblems, type WorkerDraft } from '@/lib/onboarding';

/**
 * The factory's workers, all optional: a name each; role, phone and employee code if known; an
 * email and password give them the mobile alert app. Workers can also be added later on the
 * factory's Scheduling page.
 */
export function WorkersEditor({ value, onChange, tried }: { value: WorkerDraft[]; onChange: (next: WorkerDraft[]) => void; tried: boolean }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const problems = workerProblems(value);
  const set = (k: string, patch: Partial<WorkerDraft>) => onChange(value.map((w) => (w.key === k ? { ...w, ...patch } : w)));

  return (
    <div className="mt-8">
      <h4 className="text-sm font-semibold">Workers (optional)</h4>
      <p className="text-xs text-muted">
        Operators, supervisors and technicians. An email and password give a worker the mobile alert app; leave them empty for no app.
      </p>
      <datalist id="onboard-worker-roles">
        {WORKER_ROLES.map((r) => <option key={r} value={r} />)}
      </datalist>
      <div className="mt-2 space-y-3">
        {value.map((w, i) => {
          const p = problems[i];
          return (
            <div key={w.key} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{w.name.trim() || `Worker ${i + 1}`}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((x) => x.key !== w.key))}>Remove</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Name">
                  <Input aria-label="Worker name" value={w.name} onChange={(e) => set(w.key, { name: e.target.value })} />
                  {tried && p.name && <p className="text-xs text-red-600">{p.name}</p>}
                </Field>
                <Field label="Role">
                  <Input aria-label="Worker role" list="onboard-worker-roles" value={w.role} onChange={(e) => set(w.key, { role: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input aria-label="Worker phone" type="tel" value={w.phone} placeholder="+91 98765 43210" onChange={(e) => set(w.key, { phone: e.target.value })} />
                  {(tried || w.phone) && p.phone && <p className="text-xs text-red-600">{p.phone}</p>}
                </Field>
                <Field label="Employee code">
                  <Input aria-label="Employee code" value={w.employee_code} onChange={(e) => set(w.key, { employee_code: e.target.value })} />
                </Field>
                <Field label="Email (app login)">
                  <Input aria-label="Worker email" type="email" autoComplete="off" value={w.email} onChange={(e) => set(w.key, { email: e.target.value })} />
                  {(tried || w.email) && p.email && <p className="text-xs text-red-600">{p.email}</p>}
                </Field>
                <Field label="Password (app login)">
                  <div className="flex gap-2">
                    <Input
                      aria-label="Worker app password"
                      type={shown[w.key] ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="font-mono"
                      value={w.password}
                      onChange={(e) => set(w.key, { password: e.target.value })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        set(w.key, { password: generatePassword() });
                        setShown((s) => ({ ...s, [w.key]: true }));
                      }}
                    >
                      New
                    </Button>
                  </div>
                  {tried && p.password && <p className="text-xs text-red-600">{p.password}</p>}
                </Field>
              </div>
            </div>
          );
        })}
      </div>
      <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onChange([...value, newWorker()])}>
        + Add worker
      </Button>
    </div>
  );
}
