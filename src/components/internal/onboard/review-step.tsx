'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { SETUP_BOARD_SLOTS, SETUP_STEPS, emailList, shiftLabel, type SetupDraft, type SetupStepKey } from '@/lib/onboarding';
import { formatPeriod, isDayKey } from '@/lib/subscriptions';

function Row({ label, step, onEdit, children }: { label: string; step: SetupStepKey; onEdit: (i: number) => void; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[10rem_1fr_auto] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 space-y-0.5 text-sm">{children}</dd>
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(SETUP_STEPS.findIndex((s) => s.key === step))}>Edit</Button>
      </div>
    </div>
  );
}

const None = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>;

/** Everything filled in, one row per step, each with a way back to change it. No passwords shown. */
export function ReviewStep({ d, onEdit }: { d: SetupDraft; onEdit: (i: number) => void }) {
  const f = d.factory;
  const s = d.subscription;
  const featureChanges = Object.keys(d.look.features).length;
  const appLogins = d.workers.filter((w) => w.email.trim() && w.password).length;
  const reportEmails = emailList(d.reports.emails);
  const machinesOn = (key: string) => d.machines.filter((m) => m.line_key === key).length;
  const lineName = (key: string) => {
    const l = d.lines.find((x) => x.key === key);
    return l ? l.name.trim() || l.line_id.trim() : '—';
  };
  const machineName = new Map(d.machines.map((m) => [m.key, m.name.trim()]));

  return (
    <>
      <CardHeader title="Review" description="Check everything, then create. It is created all at once, or not at all; the welcome emails go out straight after." />
      <dl>
        <Row label="Company" step="company" onEdit={onEdit}>
          <div>
            <span className="font-medium">{d.company.name.replace(/\s+/g, ' ').trim()}</span>
            <span className="text-muted">{d.company.mode === 'existing' ? ' · a plant added to it' : ' · new'}</span>
          </div>
        </Row>
        <Row label="Factory" step="factory" onEdit={onEdit}>
          <div><span className="font-medium">{f.name.trim()}</span>{f.location.trim() && <span className="text-muted"> · {f.location.trim()}</span>}</div>
          <div className="font-mono text-xs text-muted">{f.factory_id.trim()}</div>
          {(f.referred_by ?? '').trim() && <div className="text-muted">Referred by {(f.referred_by ?? '').trim()}</div>}
        </Row>
        <Row label="Look" step="look" onEdit={onEdit}>
          {!d.look.logo && !d.look.accent_color && featureChanges === 0 && <None>FloorBeat defaults</None>}
          {d.look.logo && <div>Logo: {d.look.logo.name}</div>}
          {d.look.accent_color && (
            <div className="flex items-center gap-2">
              Colour: <span className="inline-block h-3 w-3 rounded-full border" style={{ background: d.look.accent_color }} />
              <span className="font-mono text-xs">{d.look.accent_color}</span>
            </div>
          )}
          {featureChanges > 0 && <div>{featureChanges} page or section switch{featureChanges === 1 ? '' : 'es'} changed</div>}
        </Row>
        <Row label="Subscription" step="subscription" onEdit={onEdit}>
          {!s.enabled ? <None>None yet: not limited</None> : (
            <>
              <div>{isDayKey(s.starts_on) && isDayKey(s.ends_on) ? formatPeriod(s.starts_on, s.ends_on) : '—'}</div>
              <div className="text-muted">
                {[s.plan.trim(), s.machines.trim() && `${s.machines.trim()} machines`, s.monthly_amount.trim() && `₹${s.monthly_amount.trim()} a month`].filter(Boolean).join(' · ') || 'No plan details'}
              </div>
            </>
          )}
        </Row>
        <Row label="Shifts" step="shifts" onEdit={onEdit}>
          {[...d.shifts].sort((a, b) => a.start_hour - b.start_hour).map((x) => (
            <div key={x.shift_id}><span className="font-medium">{x.shift_id}</span> {x.name} <span className="text-muted tabular-nums">{shiftLabel(x)}</span></div>
          ))}
        </Row>
        <Row label="Lines & machines" step="lines" onEdit={onEdit}>
          {d.lines.length === 0 ? <None>None yet</None> : d.lines.map((l) => (
            <div key={l.key}>{l.name.trim() || l.line_id.trim()} <span className="text-muted">· {machinesOn(l.key)} machine{machinesOn(l.key) === 1 ? '' : 's'}</span></div>
          ))}
        </Row>
        <Row label="WiFi" step="wifi" onEdit={onEdit}>
          {d.wifi.length === 0 ? <None>None (boards use 4G or their own networks)</None> : d.wifi.map((n, i) => (
            <div key={n.key}>{i + 1}. {n.ssid.trim()} {n.pass === '' && <span className="text-muted">(open)</span>}</div>
          ))}
        </Row>
        <Row label="Boards" step="boards" onEdit={onEdit}>
          {d.boards.length === 0 ? <None>None now (claimed later on the Boards page)</None> : d.boards.map((b) => {
            const mapped = SETUP_BOARD_SLOTS.filter((slot) => machineName.get(b.channels[slot] ?? ''));
            return (
              <div key={b.key}>
                <span className="font-mono">{b.board_id}</span>
                <span className="text-muted">
                  {b.rescue
                    ? ' · rescue box'
                    : ` · ${lineName(b.line_key)} · ${mapped.length === 0 ? 'no sensors matched yet' : mapped.map((slot) => `${slot} ${machineName.get(b.channels[slot])}`).join(', ')}`}
                </span>
              </div>
            );
          })}
        </Row>
        <Row label="People" step="people" onEdit={onEdit}>
          {d.admins.map((a) => <div key={a.key}>Admin: {a.email.trim().toLowerCase()}</div>)}
          {d.workers.length > 0 && (
            <div className="text-muted">
              {d.workers.length} worker{d.workers.length === 1 ? '' : 's'}{appLogins > 0 ? `, ${appLogins} with the alert app` : ''}
            </div>
          )}
        </Row>
        <Row label="Reports & alerts" step="reports" onEdit={onEdit}>
          <div>{reportEmails.length > 0 ? `Shift reports to ${reportEmails.join(', ')}` : <None>No shift reports</None>}</div>
          <div className="text-muted">
            Mobile alerts {d.reports.mobile_enabled ? 'on' : 'off'}
            {d.reports.owner_contacts.length > 0 ? ` · ${d.reports.owner_contacts.length} owner phone${d.reports.owner_contacts.length === 1 ? '' : 's'}` : ''}
            {d.reports.value_per_loom_hour.trim() ? ` · ₹${d.reports.value_per_loom_hour.trim()} per running hour` : ''}
            {d.reports.monthly_email ? '' : ' · no monthly email'}
          </div>
        </Row>
      </dl>
    </>
  );
}
