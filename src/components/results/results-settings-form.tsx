'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import {
  dayInputToIso, dayInputValue, parseRupeesInput, type ResultsSettings,
} from '@/lib/results';

const DAY_MS = 86_400_000;
const amountText = (v: number | null) => (v == null ? '' : String(v));

/**
 * What turns hours into rupees, and the monthly email: the value of a running machine-hour, the
 * service fee per machine, an optional one-time setup fee, the first month to compare with (set by
 * hand only when the automatic one is wrong) and who gets the email. Factory admins.
 */
export function ResultsSettingsForm({
  factoryId,
  settings,
  onDone,
}: {
  factoryId: string;
  settings: ResultsSettings;
  onDone: () => void;
}) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(amountText(settings.value_per_loom_hour));
  const [fee, setFee] = useState(amountText(settings.fee_per_machine_month));
  const [setup, setSetup] = useState(amountText(settings.setup_fee));
  const [ownBaseline, setOwnBaseline] = useState(Boolean(settings.baseline_from && settings.baseline_to));
  const [from, setFrom] = useState(dayInputValue(settings.baseline_from));
  // The end is stored as the midnight after the last day; the form shows the last day itself.
  const [to, setTo] = useState(
    settings.baseline_to ? dayInputValue(new Date(new Date(settings.baseline_to).getTime() - DAY_MS).toISOString()) : '',
  );
  const [monthlyEmail, setMonthlyEmail] = useState(settings.monthly_email);
  const [emailRupees, setEmailRupees] = useState(settings.monthly_email_rupees);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: Partial<ResultsSettings>) => api.saveResultsSettings(factoryId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['results', factoryId] });
      await queryClient.invalidateQueries({ queryKey: ['setup-progress', factoryId] });
      onDone();
    },
    onError: (err: Error) => setProblem(err.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amounts = {
      value_per_loom_hour: parseRupeesInput(value),
      fee_per_machine_month: parseRupeesInput(fee),
      setup_fee: parseRupeesInput(setup),
    };
    if (Object.values(amounts).some((a) => a === undefined)) {
      setProblem(t('Write amounts in rupees, like 350 or 1,500.'));
      return;
    }
    let baseline: { baseline_from: string | null; baseline_to: string | null } = { baseline_from: null, baseline_to: null };
    if (ownBaseline) {
      const start = dayInputToIso(from);
      const lastDay = dayInputToIso(to);
      if (!start || !lastDay) {
        setProblem(t('Pick the first and the last day of the first month.'));
        return;
      }
      baseline = { baseline_from: start, baseline_to: new Date(new Date(lastDay).getTime() + DAY_MS).toISOString() };
    }
    setProblem(null);
    save.mutate({
      value_per_loom_hour: amounts.value_per_loom_hour ?? null,
      fee_per_machine_month: amounts.fee_per_machine_month ?? null,
      setup_fee: amounts.setup_fee ?? null,
      ...baseline,
      monthly_email: monthlyEmail,
      monthly_email_rupees: emailRupees,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('What a running machine-hour earns (₹)')}>
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="350" />
          <p className="text-xs text-muted">{t('Your margin on what one machine makes in an hour. Turns recovered hours into rupees.')}</p>
        </Field>
        <Field label={t('Service fee per machine per month (₹)')}>
          <Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          <p className="text-xs text-muted">{t('As on the FloorBeat invoice.')}</p>
        </Field>
        <Field label={t('One-time setup fee (₹, if any)')}>
          <Input inputMode="decimal" value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="0" />
          <p className="text-xs text-muted">{t('Leave empty when there was none: then there is nothing to pay back.')}</p>
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">{t('First month to compare with')}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="baseline" checked={!ownBaseline} onChange={() => setOwnBaseline(false)} className="mt-1" />
          <span>{t('Automatic: the first 30 days after the first recorded shift')}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="baseline" checked={ownBaseline} onChange={() => setOwnBaseline(true)} className="mt-1" />
          <span>{t('Set by hand (at least 7 days, all in the past)')}</span>
        </label>
        {ownBaseline && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('First day')}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t('Last day')}>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">{t('Monthly results email')}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={monthlyEmail} onChange={(e) => setMonthlyEmail(e.target.checked)} className="mt-1" />
          <span>{t('Email last month\'s results on the 2nd to the shift report list')}</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={emailRupees}
            disabled={!monthlyEmail}
            onChange={(e) => setEmailRupees(e.target.checked)}
            className="mt-1"
          />
          <span>{t('Include the rupee figures (everyone on that list will see them)')}</span>
        </label>
      </fieldset>

      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>{t('Cancel')}</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? t('Saving…') : t('Save')}</Button>
      </div>
    </form>
  );
}
