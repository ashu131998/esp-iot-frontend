'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Copy, Printer, Settings2 } from 'lucide-react';
import { useState } from 'react';

import { ResultsSettingsForm } from '@/components/results/results-settings-form';
import { StopFollowUpTiles } from '@/components/results/stop-follow-up-tiles';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { Sheet } from '@/components/ui/sheet';
import { ListGroup, ListRow, NumberTile, NumberTiles, SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useShown } from '@/lib/factory-refs-context';
import { formatDateTime, formatFullDate, formatUpTo } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { humanMinutes } from '@/lib/plain-words';
import {
  caseStudyText, formatPct, formatRupees, formatSignedHours, monthLabel, recoveredTone, resultsQueryKey,
  type ResultsResponse,
} from '@/lib/results';

/**
 * Results: what the service gave the factory back in a month — machine-hours won back against its
 * first month, what they are worth against the service fee, and how stop alerts were followed up.
 * Printable as the monthly report; admins and our staff can copy it as a case study.
 */
export function ResultsDashboard({
  factoryId,
  factoryName,
  location,
  initialMonth,
  openSettings = false,
}: {
  factoryId: string;
  factoryName: string;
  location?: string | null;
  initialMonth?: string;
  openSettings?: boolean;
}) {
  const { t, locale } = useT();
  const shown = useShown();
  const { canWriteFactory, isInternalStaff } = useAuth();
  const [month, setMonth] = useState<string | null>(initialMonth ?? null);
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: resultsQueryKey(factoryId, month),
    queryFn: ({ signal }) => api.results(factoryId, month ?? undefined, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (isLoading && !data) return <StatGridSkeleton count={4} />;
  if (error || !data) {
    return <SummaryCard tone="bad" badge="!" title={t('Results could not be loaded')} subtitle={(error as Error | null)?.message} />;
  }

  const label = monthLabel(data.month, locale);
  const canCopy = canWriteFactory || isInternalStaff;

  async function copyCaseStudy(r: ResultsResponse) {
    try {
      await navigator.clipboard.writeText(caseStudyText({ factoryName, location, results: r }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select
          aria-label={t('Month')}
          className="w-auto min-w-[11rem]"
          value={month ?? data.month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {(data.months.includes(month ?? data.month) ? data.months : [month ?? data.month, ...data.months]).map((m) => (
            <option key={m} value={m}>{monthLabel(m, locale)}</option>
          ))}
        </Select>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          {t('Print')}
        </Button>
        {canCopy && (
          <Button variant="secondary" size="sm" onClick={() => copyCaseStudy(data)}>
            <Copy className="mr-1.5 h-4 w-4" />
            {copied ? t('Copied') : t('Copy as case study')}
          </Button>
        )}
        {canWriteFactory && data.settings && (
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            {t('Settings')}
          </Button>
        )}
      </div>

      <h2 className="hidden text-lg font-semibold print:block">{t('Results · {month}', { month: label })}</h2>

      <Headline data={data} label={label} />

      {data.totals && data.totals.recovered_hours != null && (
        <NumberTiles>
          <NumberTile
            label={t('Machine-hours recovered')}
            value={formatSignedHours(data.totals.recovered_hours, locale)}
            hint={t('against your first month')}
            tone={recoveredTone(data.totals.recovered_hours)}
          />
          <NumberTile
            label={t('Running')}
            value={formatPct(data.totals.running_pct, locale)}
            hint={t('first month {pct}', { pct: formatPct(data.totals.baseline_running_pct, locale) })}
          />
          <NumberTile
            label={t('Stopped')}
            value={t('{hours} h', { hours: formatUpTo(data.totals.stopped_hours ?? 0, 1, locale) })}
            hint={t('{hours} h at the first month\'s rate', { hours: formatUpTo(data.totals.stopped_hours_at_baseline ?? 0, 1, locale) })}
          />
          <NumberTile
            label={t('Since the first month')}
            value={formatSignedHours(data.since_baseline?.totals.recovered_hours ?? null, locale)}
            hint={t('all months after it, together')}
            tone={recoveredTone(data.since_baseline?.totals.recovered_hours ?? null)}
          />
        </NumberTiles>
      )}

      {shown('results.money') && data.money && data.totals && (
        <ListGroup title={t('What it is worth')}>
          <div className="p-4">
            <MoneyTiles data={data} />
          </div>
        </ListGroup>
      )}

      {shown('results.stops') && data.stops && data.stops.stops > 0 && (
        <ListGroup title={t('Stop follow-up in {month}', { month: label })} count={data.stops.stops}>
          <div className="p-4">
            <StopFollowUpTiles data={data.stops} />
          </div>
          {data.stops.reasons.slice(0, 5).map((r) => (
            <ListRow
              key={r.code ?? 'none'}
              title={r.label ?? t('No reason given')}
              detail={t('{count} stops', { count: r.stops })}
              value={humanMinutes(r.minutes, t)}
              valueHint={t('stopped')}
            />
          ))}
        </ListGroup>
      )}

      {shown('results.machines') && data.machines.length > 0 && (
        <ListGroup title={t('Each machine against its first month')} count={data.machines.length}>
          {[...data.machines]
            .sort((a, b) => (b.recovered_hours ?? -Infinity) - (a.recovered_hours ?? -Infinity))
            .map((m) => (
              <ListRow
                key={m.machine_id}
                href={`/factories/${factoryId}/machines/${m.machine_id}`}
                tone={m.status === 'compared' ? recoveredTone(m.recovered_hours) : 'idle'}
                title={m.machine_name}
                detail={m.status === 'no_baseline'
                  ? t('Not enough first-month data to compare yet')
                  : m.status === 'no_data'
                    ? t('Not watched this month')
                    : t('Running {now} · first month {base}', {
                      now: formatPct(m.running_pct, locale), base: formatPct(m.baseline_running_pct, locale),
                    })}
                value={m.status === 'compared' ? formatSignedHours(m.recovered_hours, locale) : undefined}
              />
            ))}
        </ListGroup>
      )}

      <Footnotes data={data} />

      {settingsOpen && data.settings && (
        <Sheet title={t('Results settings')} onClose={() => setSettingsOpen(false)}>
          <ResultsSettingsForm factoryId={factoryId} settings={data.settings} onDone={() => setSettingsOpen(false)} />
        </Sheet>
      )}
    </div>
  );
}

/** The one sentence to read first, for each state the month can be in. */
function Headline({ data, label }: { data: ResultsResponse; label: string }) {
  const { t, locale } = useT();
  if (!data.baseline) {
    return (
      <SummaryCard
        tone="idle"
        badge="…"
        title={t('No shift saved yet')}
        subtitle={t('Results start with the first full shift. The first 30 days become the month every later month is compared with.')}
      />
    );
  }
  if (!data.baseline.ready) {
    return (
      <SummaryCard
        tone="idle"
        badge={data.baseline.days_done}
        title={t('Measuring your first month: day {done} of {total}', { done: data.baseline.days_done, total: data.baseline.days_total })}
        subtitle={t('From then on, each month shows the machine-hours won back against it.')}
      />
    );
  }
  if (!data.window) {
    return (
      <SummaryCard
        tone="idle"
        badge="="
        title={t('{month} is part of your first month', { month: label })}
        subtitle={t('It is what later months are measured against.')}
      />
    );
  }
  if (!data.totals || data.totals.recovered_hours == null) {
    return (
      <SummaryCard
        tone="idle"
        badge="…"
        title={t('No saved shift in {month} yet', { month: label })}
        subtitle={t('Shifts are saved soon after they end.')}
      />
    );
  }
  const hours = data.totals.recovered_hours;
  const tone = recoveredTone(hours);
  return (
    <SummaryCard
      tone={tone === 'idle' ? 'good' : tone}
      badge={hours >= 0 ? '+' : '−'}
      title={hours >= 0
        ? t('{hours} machine-hours won back in {month}', { hours: formatUpTo(Math.abs(hours), 1, locale), month: label })
        : t('{hours} machine-hours below your first month in {month}', { hours: formatUpTo(Math.abs(hours), 1, locale), month: label })}
      subtitle={t('{count} machines compared, each against its own first month', { count: data.totals.compared_machines })}
    />
  );
}

function MoneyTiles({ data }: { data: ResultsResponse }) {
  const { t, locale } = useT();
  const money = data.money!;
  const value = data.settings?.value_per_loom_hour ?? null;
  const fee = data.settings?.fee_per_machine_month ?? null;
  return (
    <NumberTiles>
      <NumberTile
        label={t('Worth')}
        value={formatRupees(money.recovered_rupees, locale)}
        hint={value != null
          ? t('at {rupees} a machine-hour', { rupees: formatRupees(value, locale) })
          : t('Set what a machine-hour earns in Settings')}
        tone={money.recovered_rupees != null ? recoveredTone(money.recovered_rupees) : undefined}
      />
      <NumberTile
        label={t('Service fee')}
        value={formatRupees(money.service_fee_rupees, locale)}
        hint={fee != null
          ? t('{rupees} a machine a month, {count} machines', { rupees: formatRupees(fee, locale), count: data.machines_monitored })
          : t('Set the fee in Settings')}
      />
      <NumberTile
        label={t('Return on the fee')}
        value={money.return_multiple != null ? `${formatUpTo(money.return_multiple, 1, locale)}×` : '—'}
        hint={money.net_rupees != null ? t('{rupees} left after the fee', { rupees: formatRupees(money.net_rupees, locale) }) : undefined}
      />
      <NumberTile
        label={t('Payback')}
        value={money.no_upfront_cost
          ? t('No upfront cost')
          : money.payback_months != null
            ? t('{months} months', { months: formatUpTo(money.payback_months, 1, locale) })
            : '—'}
        hint={money.no_upfront_cost
          ? t('Machine Monitoring as a Service')
          : t('of the {rupees} setup fee', { rupees: formatRupees(money.setup_fee_rupees, locale) })}
      />
    </NumberTiles>
  );
}

function Footnotes({ data }: { data: ResultsResponse }) {
  const { t, locale } = useT();
  const notes: string[] = [];
  if (data.baseline) {
    const lastDay = new Date(new Date(data.baseline.to).getTime() - 1);
    notes.push(data.baseline.source === 'set'
      ? t('First month (set by hand): {from} to {to}.', { from: formatFullDate(data.baseline.from, locale), to: formatFullDate(lastDay, locale) })
      : t('First month: {from} to {to}, the first 30 days of recorded shifts.', { from: formatFullDate(data.baseline.from, locale), to: formatFullDate(lastDay, locale) }));
  }
  if (data.data_to) notes.push(t('Counted up to the shift that ended {time}.', { time: formatDateTime(data.data_to, locale) }));
  const closed = data.closed_shifts + (data.baseline?.closed_shifts ?? 0);
  if (closed > 0) {
    notes.push(t('{count} shifts were left out because the floor was closed (under 10% running): holidays never count as lost time.', { count: closed }));
  }
  if (notes.length === 0) return null;
  return (
    <div className="space-y-1 px-1 text-xs text-muted">
      {notes.map((n) => <p key={n}>{n}</p>)}
    </div>
  );
}
