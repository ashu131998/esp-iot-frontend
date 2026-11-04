'use client';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { emailList, newContact, reportsProblems, type ReportsDraft } from '@/lib/onboarding';

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Who hears from FloorBeat, and the figures its results are worth: the shift-report list (also
 * where the monitoring alerts go), mobile alerts and the owners' phones, and the rupee figures for
 * the Results page. All optional; each has its own page later.
 */
export function ReportsStep({
  value, onChange, adminEmails, tried,
}: { value: ReportsDraft; onChange: (next: ReportsDraft) => void; adminEmails: string[]; tried: boolean }) {
  const set = (patch: Partial<ReportsDraft>) => onChange({ ...value, ...patch });
  const problems = reportsProblems(value);
  const listed = emailList(value.emails);
  const missingAdmins = adminEmails.filter((e) => !listed.includes(e));
  const setContact = (k: string, patch: { name?: string; phone?: string }) =>
    set({ owner_contacts: value.owner_contacts.map((c) => (c.key === k ? { ...c, ...patch } : c)) });

  return (
    <>
      <CardHeader
        title="Reports & alerts"
        description="Optional. Who gets the shift reports and alerts, and the figures for the Results page. Each can be changed later on its own page."
      />

      <h4 className="text-sm font-semibold">Shift reports</h4>
      <Field label="Emails (one per line, or separated by commas)">
        <Textarea rows={3} value={value.emails} placeholder="owner@factory.in" onChange={(e) => set({ emails: e.target.value })} />
      </Field>
      {tried && problems.emails && <p className="text-xs text-red-600">{problems.emails}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>After every shift, and the monitoring alerts (machines that stop reporting). {listed.length > 0 ? `${listed.length} listed.` : 'None yet: no reports.'}</span>
        {missingAdmins.length > 0 && (
          <Button type="button" size="sm" variant="secondary" onClick={() => set({ emails: [...listed, ...missingAdmins].join('\n') })}>
            + Add the admins&apos; emails
          </Button>
        )}
      </div>

      <h4 className="mt-6 text-sm font-semibold">Alerts</h4>
      <div className="mt-2 space-y-2">
        <Switch checked={value.mobile_enabled} onChange={(v) => set({ mobile_enabled: v })} label="Mobile alerts" hint="Workers with the app are told when their machine stops." />
        <Switch checked={value.notify_owner_on_down} onChange={(v) => set({ notify_owner_on_down: v })} label="Tell the owners when a machine stops" />
      </div>
      <div className="mt-3 space-y-2">
        {value.owner_contacts.map((c) => (
          <div key={c.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input aria-label="Owner name" value={c.name} placeholder="Name" onChange={(e) => setContact(c.key, { name: e.target.value })} />
            <Input aria-label="Owner phone" type="tel" value={c.phone} placeholder="+91 98765 43210" onChange={(e) => setContact(c.key, { phone: e.target.value })} />
            <Button type="button" size="sm" variant="ghost" aria-label="Remove contact" onClick={() => set({ owner_contacts: value.owner_contacts.filter((x) => x.key !== c.key) })}>✕</Button>
          </div>
        ))}
        {tried && problems.contacts && <p className="text-xs text-red-600">{problems.contacts}</p>}
        <Button type="button" size="sm" variant="secondary" disabled={value.owner_contacts.length >= 10} onClick={() => set({ owner_contacts: [...value.owner_contacts, newContact()] })}>
          + Add owner phone
        </Button>
      </div>

      <h4 className="mt-6 text-sm font-semibold">Results figures</h4>
      <p className="text-xs text-muted">For the Results page: what the hours won back are worth against the service fee.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Field label="One running machine-hour (₹)">
          <Input inputMode="decimal" value={value.value_per_loom_hour} placeholder="350" onChange={(e) => set({ value_per_loom_hour: e.target.value })} />
        </Field>
        <Field label="Fee per machine per month (₹)">
          <Input inputMode="decimal" value={value.fee_per_machine_month} placeholder="600" onChange={(e) => set({ fee_per_machine_month: e.target.value })} />
        </Field>
        <Field label="Setup fee (₹)">
          <Input inputMode="decimal" value={value.setup_fee} placeholder="0" onChange={(e) => set({ setup_fee: e.target.value })} />
        </Field>
      </div>
      {tried && problems.money && <p className="text-xs text-red-600">{problems.money}</p>}
      <div className="mt-2">
        <Switch checked={value.monthly_email} onChange={(v) => set({ monthly_email: v })} label="Monthly results email" hint="Last month's results to the shift-report list, early each month." />
      </div>
    </>
  );
}
