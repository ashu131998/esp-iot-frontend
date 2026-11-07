'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { BoardsStep } from '@/components/internal/onboard/boards-step';
import { CompanyStep } from '@/components/internal/onboard/company-step';
import { FactoryIdHint } from '@/components/internal/onboard/factory-id-hint';
import { LinesStep } from '@/components/internal/onboard/lines-step';
import { LookStep } from '@/components/internal/onboard/look-step';
import { OnboardDone, type OnboardResult } from '@/components/internal/onboard/onboard-done';
import { ReportsStep } from '@/components/internal/onboard/reports-step';
import { ReviewStep } from '@/components/internal/onboard/review-step';
import { SubscriptionStep } from '@/components/internal/onboard/subscription-step';
import { WifiStep } from '@/components/internal/onboard/wifi-step';
import { WorkersEditor } from '@/components/internal/onboard/workers-editor';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isSuperAdmin } from '@/lib/auth-types';
import {
  MAX_ONBOARD_ADMINS,
  SETUP_STEPS,
  SHIFT_PRESETS,
  addShift,
  adminProblems,
  buildSetupRequest,
  companyAdminsOf,
  isBlankAdmin,
  emailList,
  emptyAdmin,
  emptySetupDraft,
  factoryProblems,
  generatePassword,
  setAdminEmail,
  setAdminUsername,
  setupStepsOk,
  shiftLabel,
  shiftProblem,
  stepOfSection,
  suggestFactoryId,
  type AdminDraft,
  type SetupDraft,
  type SetupRequest,
  type ShiftDraft,
} from '@/lib/onboarding';
import { draftBody, draftProblems, todayKey } from '@/lib/subscriptions';
import { useStoredState } from '@/lib/use-stored-state';
import { cn } from '@/lib/utils';

const DRAFT_KEY = 'fb-onboard-draft-v2';
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const newAdmin = () => emptyAdmin(crypto.randomUUID());

type Problem = { section: string; message: string };

/** A draft saved by an older version of this page: today's shape, filled from what was kept. */
function reviveDraft(stored: unknown, fresh: SetupDraft): SetupDraft {
  if (!stored || typeof stored !== 'object') return fresh;
  const s = stored as Partial<SetupDraft>;
  const list = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  return {
    ...fresh,
    step: typeof s.step === 'number' ? s.step : 0,
    idEdited: Boolean(s.idEdited),
    company: { ...fresh.company, ...(s.company ?? {}) },
    factory: { ...fresh.factory, ...(s.factory ?? {}) },
    look: { ...fresh.look, ...(s.look ?? {}) },
    subscription: { ...fresh.subscription, ...(s.subscription ?? {}) },
    reports: { ...fresh.reports, ...(s.reports ?? {}) },
    shifts: list(s.shifts, fresh.shifts),
    lines: list(s.lines, fresh.lines),
    machines: list(s.machines, fresh.machines),
    wifi: list(s.wifi, fresh.wifi),
    boards: list(s.boards, fresh.boards),
    admins: list(s.admins, fresh.admins),
    workers: list(s.workers, fresh.workers),
  };
}

function FieldError({ children }: { children?: string }) {
  return children ? <p className="text-xs text-red-600">{children}</p> : null;
}

function Stepper({ step, bad, onJump }: { step: number; bad: boolean[]; onJump: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-sm">
      {SETUP_STEPS.map(({ key, label }, i) => (
        <li key={key} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onJump(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1',
              i === step ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-slate-100',
              i !== step && bad[i] && 'text-red-600',
            )}
          >
            <span className="font-semibold tabular-nums">{bad[i] && i !== step ? '!' : i + 1}</span>
            {label}
          </button>
          {i < SETUP_STEPS.length - 1 && <span className="text-muted">›</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * /internal/onboard: a whole factory in one form, filled in on site. Only the factory and an admin
 * are required; every other step is optional. The draft is kept on this device as it is typed
 * (lib/use-stored-state), and the factory is created all at once, or not at all.
 */
export function OnboardPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const stored = useStoredState<SetupDraft>(DRAFT_KEY, () => emptySetupDraft(todayKey()), reviveDraft);
  const d = stored.value;
  const set = stored.set;
  const step = Math.min(Math.max(d.step, 0), SETUP_STEPS.length - 1);
  const current = SETUP_STEPS[step].key;

  const [tried, setTried] = useState(false);   // show errors only after a Next on that step
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  const factoriesQuery = useQuery({ queryKey: ['admin-factories'], queryFn: ({ signal }) => api.adminFactories({ signal }) });
  const takenIds = useMemo(() => (factoriesQuery.data?.factories ?? []).map((f) => f.factory_id), [factoriesQuery.data]);
  const companiesQuery = useQuery({ queryKey: ['admin-companies'], queryFn: ({ signal }) => api.adminCompanies({ signal }) });
  const companies = useMemo(() => companiesQuery.data?.companies ?? [], [companiesQuery.data]);

  const ok = setupStepsOk(d, takenIds, draftProblems, companies);
  const bad = ok.map((x) => !x);
  const fProblems = factoryProblems(d.factory, takenIds);
  const sProblem = shiftProblem(d.shifts);
  const aProblems = adminProblems(d.admins);

  const goTo = (i: number) => {
    setTried(false);
    setConfirmReset(false);
    set((x) => ({ ...x, step: i }));
  };
  const patch = (p: Partial<SetupDraft>) => set((x) => ({ ...x, ...p }));

  const setup = useMutation({
    mutationFn: (req: SetupRequest) => api.adminSetupFactory(req),
    onSuccess: (res, req) => {
      setResult({ ...res, request: req });
      stored.clear();
      setServerProblems([]);
      qc.invalidateQueries({ queryKey: ['admin-factories'] });
      qc.invalidateQueries({ queryKey: ['admin-companies'] });
    },
    onError: (err) => {
      const problems = ((err as ApiError).body as { problems?: Problem[] } | null)?.problems ?? [];
      setServerProblems(problems);
      if (problems.length > 0) set((x) => ({ ...x, step: stepOfSection(problems[0].section) }));
    },
  });

  const next = () => {
    setTried(true);
    if (!ok[step]) return;
    // A new customer's first factory is usually named like the company: start the name from it.
    if (current === 'company' && d.company.mode === 'new' && !d.factory.name.trim()) {
      const name = d.company.name.replace(/\s+/g, ' ').trim();
      set((x) => ({ ...x, factory: { ...x.factory, name, factory_id: x.idEdited ? x.factory.factory_id : suggestFactoryId(name) } }));
    }
    goTo(step + 1);
  };
  const create = () => {
    const firstBad = ok.findIndex((x) => !x);
    if (firstBad >= 0) {
      set((x) => ({ ...x, step: firstBad }));
      setTried(true);
      return;
    }
    setServerProblems([]);
    setup.mutate(buildSetupRequest(d, draftBody));
  };
  const reset = () => {
    stored.clear();
    setResult(null);
    setTried(false);
    setConfirmReset(false);
    setServerProblems([]);
    setup.reset();
  };

  if (!stored.ready) return <p className="mx-auto max-w-3xl text-sm text-muted">Loading the form…</p>;
  if (result) return <OnboardDone result={result} onAnother={reset} />;

  const presetKey = SHIFT_PRESETS.find((p) => JSON.stringify(p.shifts) === JSON.stringify(d.shifts))?.key ?? 'custom';
  const setShifts = (fn: (s: ShiftDraft[]) => ShiftDraft[]) => set((x) => ({ ...x, shifts: fn(x.shifts) }));
  const updateShift = (i: number, p: Partial<ShiftDraft>) => setShifts((list) => list.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const setAdmins = (fn: (a: AdminDraft[]) => AdminDraft[]) => set((x) => ({ ...x, admins: fn(x.admins) }));
  const updateAdmin = (k: string, fn: (a: AdminDraft) => AdminDraft) => setAdmins((list) => list.map((a) => (a.key === k ? fn(a) : a)));
  const stepProblems = serverProblems.filter((p) => stepOfSection(p.section) === step);
  // A factory of an existing company: its admins sign in here too, so new ones are optional.
  const companyAdmins = companyAdminsOf(d.company, companies);
  const adminsOptional = companyAdmins.length > 0;
  const isLast = step === SETUP_STEPS.length - 1;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Stepper step={step} bad={tried || serverProblems.length > 0 ? bad : bad.map(() => false)} onJump={goTo} />
      <Card className="p-4 sm:p-6">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast) create();
            else next();
          }}
        >
          {stepProblems.length > 0 && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {stepProblems.map((p) => <div key={p.message}>{p.message}</div>)}
            </div>
          )}

          {current === 'company' && (
            <CompanyStep
              value={d.company}
              onChange={(company) => patch({ company })}
              companies={companies}
              loading={companiesQuery.isLoading}
              tried={tried}
            />
          )}

          {current === 'factory' && (
            <>
              <CardHeader title="Factory" description="This plant, as it will appear in its dashboard at its own address. Required, like the company and one admin." />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Factory name">
                  <Input
                    autoFocus
                    value={d.factory.name}
                    placeholder="Shree Ganesh Textiles"
                    onChange={(e) => {
                      const name = e.target.value;
                      set((x) => ({ ...x, factory: { ...x.factory, name, factory_id: x.idEdited ? x.factory.factory_id : suggestFactoryId(name) } }));
                    }}
                  />
                  {tried && <FieldError>{fProblems.name}</FieldError>}
                </Field>
                <Field label="Location">
                  <Input value={d.factory.location} placeholder="Surat, Gujarat" onChange={(e) => patch({ factory: { ...d.factory, location: e.target.value } })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Factory ID">
                    <Input
                      value={d.factory.factory_id}
                      placeholder="shree-ganesh-textiles"
                      className="font-mono"
                      onChange={(e) => patch({ idEdited: true, factory: { ...d.factory, factory_id: e.target.value.toLowerCase() } })}
                    />
                    {(tried || (d.factory.factory_id && fProblems.factory_id)) && <FieldError>{fProblems.factory_id}</FieldError>}
                    <FactoryIdHint id={d.factory.factory_id} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Referred by (partner, optional)">
                    <Input
                      value={d.factory.referred_by ?? ''}
                      maxLength={120}
                      placeholder="Patel Engineering Works, Surat"
                      onChange={(e) => patch({ factory: { ...d.factory, referred_by: e.target.value } })}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          {current === 'look' && <LookStep value={d.look} onChange={(look) => patch({ look })} tried={tried} />}

          {current === 'subscription' && (
            <SubscriptionStep value={d.subscription} onChange={(subscription) => patch({ subscription })} tried={tried} />
          )}

          {current === 'shifts' && (
            <>
              <CardHeader title="Shifts" description="How the factory's day is split. Reports and availability follow these. Admins can change them later." />
              <div className="mb-4 flex flex-wrap gap-2">
                {SHIFT_PRESETS.map((p) => (
                  <Button key={p.key} type="button" size="sm" variant={presetKey === p.key ? 'primary' : 'secondary'} onClick={() => setShifts(() => p.shifts)}>
                    {p.label}
                  </Button>
                ))}
                {presetKey === 'custom' && <span className="self-center text-sm text-muted">Custom</span>}
              </div>
              <div className="space-y-2">
                <div className="hidden grid-cols-[4rem_1fr_7rem_6rem_7rem_2rem] gap-2 px-1 text-xs font-medium text-muted sm:grid">
                  <span>Code</span><span>Name</span><span>Starts</span><span>Hours</span><span>Ends</span><span />
                </div>
                {d.shifts.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[4rem_1fr_7rem_6rem_7rem_2rem] sm:items-center sm:border-0 sm:p-0">
                    <Input aria-label="Code" value={s.shift_id} maxLength={8} onChange={(e) => updateShift(i, { shift_id: e.target.value })} />
                    <Input aria-label="Name" value={s.name} onChange={(e) => updateShift(i, { name: e.target.value })} />
                    <Select aria-label="Starts" value={s.start_hour} onChange={(e) => updateShift(i, { start_hour: Number(e.target.value) })}>
                      {HOURS.map((h) => <option key={h} value={h}>{hh(h)}</option>)}
                    </Select>
                    <Input aria-label="Hours" type="number" min={1} max={24} value={s.duration_hours} onChange={(e) => updateShift(i, { duration_hours: Number(e.target.value) })} />
                    <span className="self-center text-sm text-muted tabular-nums">{shiftLabel(s).split(' – ')[1]}</span>
                    <Button type="button" variant="ghost" size="sm" aria-label={`Remove shift ${s.shift_id}`} disabled={d.shifts.length === 1} onClick={() => setShifts((list) => list.filter((_, j) => j !== i))}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" variant="secondary" disabled={d.shifts.length >= 6} onClick={() => setShifts(addShift)}>+ Add shift</Button>
                {sProblem ? <span className="text-sm text-red-600">{sProblem}</span> : <span className="text-sm text-emerald-700">✓ Covers the full 24 h day</span>}
              </div>
            </>
          )}

          {current === 'lines' && (
            <LinesStep lines={d.lines} machines={d.machines} onChange={({ lines, machines }) => patch({ lines, machines })} tried={tried} />
          )}

          {current === 'wifi' && <WifiStep value={d.wifi} onChange={(wifi) => patch({ wifi })} tried={tried} />}

          {current === 'boards' && (
            <BoardsStep
              value={d.boards}
              lines={d.lines}
              machines={d.machines}
              onChange={(boards) => patch({ boards })}
              tried={tried}
              canClaim={isSuperAdmin(user)}
            />
          )}

          {current === 'people' && (
            <>
              <CardHeader
                title="People"
                description={adminsOptional
                  ? `${d.company.name}'s admins sign in at this factory too: add another admin only if needed. Workers belong to this factory and are optional.`
                  : 'At least one admin: each gets a welcome email with their sign-in details and a link to the factory dashboard. Admins work at every factory of the company; workers belong to this one and are optional.'}
              />
              {adminsOptional && (
                <div className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
                  <div className="font-medium">Admins of {d.company.name}</div>
                  <div className="break-words">{companyAdmins.map((a) => a.email ?? a.username).join(', ')}</div>
                  <div className="mt-1 text-xs text-indigo-800/80">One account each for every factory of the company. Leave the row below empty to add none.</div>
                </div>
              )}
              <div className="space-y-3">
                {d.admins.map((a, i) => {
                  // An empty row is none when the company's admins cover the factory: no errors for it.
                  const p = adminsOptional && isBlankAdmin(a) ? {} : aProblems[i];
                  return (
                    <div key={a.key} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">Admin {i + 1}</span>
                        {d.admins.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setAdmins((l) => l.filter((x) => x.key !== a.key))}>Remove</Button>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Email">
                          <Input type="email" autoComplete="off" value={a.email} placeholder="owner@factory.in" onChange={(e) => updateAdmin(a.key, (x) => setAdminEmail(x, e.target.value))} />
                          {tried && <FieldError>{p.email}</FieldError>}
                        </Field>
                        <Field label="Password">
                          <div className="flex gap-2">
                            <Input
                              type={shown[a.key] ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="font-mono"
                              value={a.password}
                              onChange={(e) => updateAdmin(a.key, (x) => ({ ...x, password: e.target.value }))}
                            />
                            <Button type="button" size="sm" variant="secondary" onClick={() => setShown((s) => ({ ...s, [a.key]: !s[a.key] }))}>
                              {shown[a.key] ? 'Hide' : 'Show'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                updateAdmin(a.key, (x) => ({ ...x, password: generatePassword() }));
                                setShown((s) => ({ ...s, [a.key]: true }));
                              }}
                            >
                              Generate
                            </Button>
                          </div>
                          {tried && <FieldError>{p.password}</FieldError>}
                        </Field>
                        <Field label="Username">
                          <Input autoComplete="off" value={a.username} onChange={(e) => updateAdmin(a.key, (x) => setAdminUsername(x, e.target.value))} />
                          {tried && <FieldError>{p.username}</FieldError>}
                          {!a.usernameEdited && <p className="text-xs text-muted">Same as the email unless you change it.</p>}
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={d.admins.length >= MAX_ONBOARD_ADMINS} onClick={() => setAdmins((l) => [...l, newAdmin()])}>
                + Add another admin
              </Button>
              <WorkersEditor value={d.workers} onChange={(workers) => patch({ workers })} tried={tried} />
            </>
          )}

          {current === 'reports' && (
            <ReportsStep
              value={d.reports}
              onChange={(reports) => patch({ reports })}
              adminEmails={emailList(d.admins.map((a) => a.email).join(','))}
              tried={tried}
            />
          )}

          {current === 'review' && (
            <>
              <ReviewStep d={d} onEdit={goTo} />
              {setup.error && serverProblems.length === 0 && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{setup.error.message}</p>
              )}
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={step === 0 || setup.isPending} onClick={() => goTo(step - 1)}>Back</Button>
              {confirmReset ? (
                <span className="flex items-center gap-2 text-xs">
                  Clear the whole form?
                  <Button type="button" size="sm" variant="danger" onClick={reset}>Clear</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Keep</Button>
                </span>
              ) : (
                <Button type="button" size="sm" variant="ghost" className="text-muted" onClick={() => setConfirmReset(true)}>Start over</Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted sm:inline">Saved on this device as you type</span>
              {isLast ? (
                <Button type="submit" disabled={setup.isPending}>{setup.isPending ? 'Creating…' : 'Create factory'}</Button>
              ) : (
                <Button type="submit">Next</Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
