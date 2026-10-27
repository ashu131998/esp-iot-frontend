'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  MAX_ONBOARD_ADMINS,
  SHIFT_PRESETS,
  addShift,
  adminProblems,
  buildOnboardRequest,
  emptyAdmin,
  factoryProblems,
  generatePassword,
  hasProblems,
  setAdminEmail,
  setAdminUsername,
  shiftLabel,
  shiftProblem,
  signInDetailsText,
  suggestFactoryId,
  type AdminDraft,
  type FactoryDraft,
  type OnboardRequest,
  type ShiftDraft,
} from '@/lib/onboarding';
import { cn } from '@/lib/utils';

const STEPS = ['Factory', 'Shifts', 'Admins', 'Review'] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const newAdmin = () => emptyAdmin(crypto.randomUUID());

type Result = Awaited<ReturnType<typeof api.onboardFactory>> & { request: OnboardRequest };

function FieldError({ children }: { children?: string }) {
  return children ? <p className="text-xs text-red-600">{children}</p> : null;
}

function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <button
            type="button"
            disabled={i >= step}
            onClick={() => onJump(i)}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1',
              i === step && 'bg-primary text-primary-foreground',
              i < step && 'bg-blue-50 text-primary hover:bg-blue-100',
              i > step && 'text-muted',
            )}
          >
            <span className="font-semibold tabular-nums">{i < step ? '✓' : i + 1}</span>
            {label}
          </button>
          {i < STEPS.length - 1 && <span className="text-muted">›</span>}
        </li>
      ))}
    </ol>
  );
}

export function OnboardPanel() {
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);   // show errors only after a Next on that step
  const [factory, setFactory] = useState<FactoryDraft>({ factory_id: '', name: '', location: '' });
  const [idEdited, setIdEdited] = useState(false);
  const [shifts, setShifts] = useState<ShiftDraft[]>(SHIFT_PRESETS[0].shifts);
  const [admins, setAdmins] = useState<AdminDraft[]>(() => [newAdmin()]);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<Result | null>(null);

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });
  const takenIds = useMemo(
    () => (factoriesQuery.data?.factories ?? []).map((f) => f.factory_id),
    [factoriesQuery.data],
  );

  const fProblems = factoryProblems(factory, takenIds);
  const sProblem = shiftProblem(shifts);
  const aProblems = adminProblems(admins);
  const stepOk = [!hasProblems(fProblems), sProblem === null, !hasProblems(aProblems), true];

  const onboard = useMutation({
    mutationFn: (req: OnboardRequest) => api.onboardFactory(req),
    onSuccess: (res, req) => {
      setResult({ ...res, request: req });
      qc.invalidateQueries({ queryKey: ['admin-factories'] });
    },
  });

  const next = () => {
    setTried(true);
    if (!stepOk[step]) return;
    setTried(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const reset = () => {
    setStep(0);
    setTried(false);
    setFactory({ factory_id: '', name: '', location: '' });
    setIdEdited(false);
    setShifts(SHIFT_PRESETS[0].shifts);
    setAdmins([newAdmin()]);
    setShown({});
    setResult(null);
    onboard.reset();
  };

  if (result) return <OnboardDone result={result} onAnother={reset} />;

  const presetKey = SHIFT_PRESETS.find((p) => JSON.stringify(p.shifts) === JSON.stringify(shifts))?.key ?? 'custom';
  const updateShift = (i: number, patch: Partial<ShiftDraft>) =>
    setShifts((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updateAdmin = (key: string, fn: (a: AdminDraft) => AdminDraft) =>
    setAdmins((list) => list.map((a) => (a.key === key ? fn(a) : a)));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Stepper step={step} onJump={(i) => { setTried(false); setStep(i); }} />

      <Card className="p-6">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) next();
            else onboard.mutate(buildOnboardRequest(factory, shifts, admins));
          }}
        >
          {step === 0 && (
            <>
              <CardHeader title="Factory" description="The customer's factory, as it will appear in the dashboard" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Factory name">
                  <Input
                    autoFocus
                    value={factory.name}
                    placeholder="Shree Ganesh Textiles"
                    onChange={(e) => {
                      const name = e.target.value;
                      setFactory((f) => ({ ...f, name, factory_id: idEdited ? f.factory_id : suggestFactoryId(name) }));
                    }}
                  />
                  {tried && <FieldError>{fProblems.name}</FieldError>}
                </Field>
                <Field label="Location">
                  <Input
                    value={factory.location}
                    placeholder="Surat, Gujarat"
                    onChange={(e) => setFactory((f) => ({ ...f, location: e.target.value }))}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Factory ID">
                    <Input
                      value={factory.factory_id}
                      placeholder="shree-ganesh-textiles"
                      className="font-mono"
                      onChange={(e) => {
                        setIdEdited(true);
                        setFactory((f) => ({ ...f, factory_id: e.target.value }));
                      }}
                    />
                    {(tried || (factory.factory_id && fProblems.factory_id)) && <FieldError>{fProblems.factory_id}</FieldError>}
                    <p className="text-xs text-muted">
                      Part of the factory&apos;s own address: app.floorbeat.in/f/
                      <span className="font-mono">{factory.factory_id.trim() || '…'}</span>. It cannot be changed later.
                    </p>
                  </Field>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader
                title="Shifts"
                description="How the factory's day is split. Reports and availability follow these. Admins can change them later."
              />
              <div className="mb-4 flex flex-wrap gap-2">
                {SHIFT_PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    size="sm"
                    variant={presetKey === p.key ? 'primary' : 'secondary'}
                    onClick={() => setShifts(p.shifts)}
                  >
                    {p.label}
                  </Button>
                ))}
                {presetKey === 'custom' && <span className="self-center text-sm text-muted">Custom</span>}
              </div>
              <div className="space-y-2">
                <div className="hidden grid-cols-[4rem_1fr_7rem_6rem_7rem_2rem] gap-2 px-1 text-xs font-medium text-muted sm:grid">
                  <span>Code</span><span>Name</span><span>Starts</span><span>Hours</span><span>Ends</span><span />
                </div>
                {shifts.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[4rem_1fr_7rem_6rem_7rem_2rem] sm:items-center sm:border-0 sm:p-0">
                    <Input aria-label="Code" value={s.shift_id} maxLength={8} onChange={(e) => updateShift(i, { shift_id: e.target.value })} />
                    <Input aria-label="Name" value={s.name} onChange={(e) => updateShift(i, { name: e.target.value })} />
                    <Select aria-label="Starts" value={s.start_hour} onChange={(e) => updateShift(i, { start_hour: Number(e.target.value) })}>
                      {HOURS.map((h) => <option key={h} value={h}>{hh(h)}</option>)}
                    </Select>
                    <Input
                      aria-label="Hours"
                      type="number"
                      min={1}
                      max={24}
                      value={s.duration_hours}
                      onChange={(e) => updateShift(i, { duration_hours: Number(e.target.value) })}
                    />
                    <span className="self-center text-sm text-muted tabular-nums">{shiftLabel(s).split(' – ')[1]}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove shift ${s.shift_id}`}
                      disabled={shifts.length === 1}
                      onClick={() => setShifts((list) => list.filter((_, j) => j !== i))}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" variant="secondary" disabled={shifts.length >= 6} onClick={() => setShifts(addShift)}>
                  + Add shift
                </Button>
                {sProblem
                  ? <span className="text-sm text-red-600">{sProblem}</span>
                  : <span className="text-sm text-emerald-700">✓ Covers the full 24 h day</span>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader
                title="Admins"
                description="Each admin gets a welcome email with their sign-in details and a link to the factory dashboard. They sign in with their email."
              />
              <div className="space-y-3">
                {admins.map((a, i) => {
                  const p = aProblems[i];
                  const show = tried || undefined;
                  return (
                    <div key={a.key} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">Admin {i + 1}</span>
                        {admins.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setAdmins((l) => l.filter((x) => x.key !== a.key))}>
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Email">
                          <Input
                            type="email"
                            autoComplete="off"
                            value={a.email}
                            placeholder="owner@factory.in"
                            onChange={(e) => updateAdmin(a.key, (x) => setAdminEmail(x, e.target.value))}
                          />
                          {show && <FieldError>{p.email}</FieldError>}
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
                          {show && <FieldError>{p.password}</FieldError>}
                        </Field>
                        <Field label="Username">
                          <Input
                            autoComplete="off"
                            value={a.username}
                            onChange={(e) => updateAdmin(a.key, (x) => setAdminUsername(x, e.target.value))}
                          />
                          {show && <FieldError>{p.username}</FieldError>}
                          {!a.usernameEdited && <p className="text-xs text-muted">Same as the email unless you change it.</p>}
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                disabled={admins.length >= MAX_ONBOARD_ADMINS}
                onClick={() => setAdmins((l) => [...l, newAdmin()])}
              >
                + Add another admin
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader title="Review" description="Check everything, then create. The welcome emails go out straight away." />
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted">Factory</dt>
                <dd>
                  <span className="font-medium">{factory.name.trim()}</span>
                  {factory.location.trim() && <span className="text-muted"> · {factory.location.trim()}</span>}
                  <div className="font-mono text-xs text-muted">{factory.factory_id.trim()}</div>
                </dd>
                <dt className="text-muted">Shifts</dt>
                <dd className="space-y-0.5">
                  {[...shifts].sort((x, y) => x.start_hour - y.start_hour).map((s) => (
                    <div key={s.shift_id}>
                      <span className="font-medium">{s.shift_id}</span> {s.name} <span className="text-muted tabular-nums">{shiftLabel(s)}</span>
                    </div>
                  ))}
                </dd>
                <dt className="text-muted">Admins ({admins.length})</dt>
                <dd className="space-y-0.5">
                  {admins.map((a) => (
                    <div key={a.key}>
                      {a.email.trim().toLowerCase()}
                      {a.username.trim().toLowerCase() !== a.email.trim().toLowerCase() && (
                        <span className="text-muted"> · username {a.username.trim()}</span>
                      )}
                    </div>
                  ))}
                </dd>
              </dl>
              {onboard.error && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{onboard.error.message}</p>
              )}
            </>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button type="button" variant="ghost" disabled={step === 0 || onboard.isPending} onClick={() => { setTried(false); setStep((s) => s - 1); }}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="submit">Next</Button>
            ) : (
              <Button type="submit" disabled={onboard.isPending}>
                {onboard.isPending ? 'Creating and sending emails…' : `Create factory + ${admins.length === 1 ? 'admin' : `${admins.length} admins`}`}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function OnboardDone({ result, onAnother }: { result: Result; onAnother: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const { factory, emails, dashboard_url: dashboardUrl, request } = result;
  const appUrl = dashboardUrl.replace(/\/f\/[^/]+$/, '');
  const failed = emails.filter((e) => !e.sent);

  const copy = async (email: string) => {
    const a = request.admins.find((x) => x.email === email);
    if (!a) return;
    try {
      await navigator.clipboard.writeText(signInDetailsText(factory.factory_id, a, appUrl));
      setCopied(email);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-6">
        <CardHeader
          title={`${factory.name} is onboarded`}
          description={failed.length === 0
            ? `Welcome email sent to ${emails.length === 1 ? 'the admin' : `all ${emails.length} admins`}.`
            : `${failed.length} of ${emails.length} welcome emails did not go — copy those sign-in details and send them yourself.`}
        />
        <ul className="divide-y rounded-lg border text-sm">
          {emails.map((e) => (
            <li key={e.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{e.email}</div>
                {e.username.toLowerCase() !== e.email.toLowerCase() && <div className="text-xs text-muted">username {e.username}</div>}
                {!e.sent && <div className="text-xs text-red-600">Not sent: {e.error}</div>}
              </div>
              <div className="flex items-center gap-2">
                {e.sent
                  ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Email sent</span>
                  : (
                    <Button type="button" size="sm" variant="secondary" onClick={() => copy(e.email)}>
                      {copied === e.email ? 'Copied' : 'Copy sign-in details'}
                    </Button>
                  )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Passwords are not kept anywhere after you leave this page.
        </p>

        <h4 className="mt-6 text-sm font-semibold">Next steps</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Link href={`/internal/factories/${encodeURIComponent(factory.factory_id)}`} className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Add lines &amp; machines</div>
            <div className="text-xs text-muted">Then bind boards to them</div>
          </Link>
          <Link href="/internal/features" className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Pages &amp; branding</div>
            <div className="text-xs text-muted">Logo, colour, which pages show</div>
          </Link>
          <a href={dashboardUrl} target="_blank" rel="noreferrer" className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Open their dashboard ↗</div>
            <div className="truncate font-mono text-xs text-muted">{dashboardUrl.replace(/^https?:\/\//, '')}</div>
          </a>
        </div>

        <div className="mt-6 border-t pt-4">
          <Button type="button" variant="secondary" onClick={onAnother}>Onboard another factory</Button>
        </div>
      </Card>
    </div>
  );
}
