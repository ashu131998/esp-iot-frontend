'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Gauge } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  countComparison,
  countErrorPct,
  proposeThresholds,
  stepStatus,
  summarizeWindows,
  type LevelSummary,
} from '@/lib/calibration';
import { formatDateTime, formatDecimal, formatInt, formatUpTo } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Translator } from '@/lib/i18n/translate';
import type {
  CalibrationContext,
  CalibrationCurrentBinding,
  SaveCurrentCalibrationResponse,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const POLL_MS = 15_000;
const WINDOWS_WANTED = 2;

type Mode = 'choose' | 'current' | 'count';
type Level = 'off' | 'idle' | 'running';
const LEVELS: Level[] = ['off', 'idle', 'running'];

const LEVEL_TITLE: Record<Level, string> = {
  off: 'Step {n} of 3: machine off',
  idle: 'Step {n} of 3: motor idling',
  running: 'Step {n} of 3: machine running',
};
const LEVEL_INSTRUCTION: Record<Level, string> = {
  off: 'Switch the machine completely off. Then press Start and leave it off for about 3 minutes.',
  idle: 'Start the motor but do not weave: let it idle. Press Start, then leave it like that for about 3 minutes.',
  running: 'Run the machine normally. Press Start and keep it running for about 3 minutes.',
};
const LEVEL_WORD: Record<Level, string> = { off: 'Off', idle: 'Idle', running: 'Running' };

/**
 * Calibrate a machine from the dashboard, step by step: either its running / stopped detection
 * (measure it off, idling and running, then save the two current thresholds — the running one
 * also goes to the board, per channel) or its production count (one timed run against the
 * machine's own counter gives pulses per unit). Opens in a Sheet from the machine page.
 */
export function CalibrationWizard({
  factoryId,
  machineId,
  onClose,
}: {
  factoryId: string;
  machineId: string;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('choose');
  const [bindingId, setBindingId] = useState<string | null>(null);

  const ctxQuery = useQuery({
    queryKey: ['calibration-context', factoryId, machineId],
    queryFn: ({ signal }) => api.calibrationContext(factoryId, machineId, { signal }),
  });
  const ctx = ctxQuery.data;

  function afterSave() {
    void queryClient.invalidateQueries({ queryKey: ['calibration-context', factoryId, machineId] });
    void queryClient.invalidateQueries({ queryKey: ['sensor-bindings', factoryId] });
    void queryClient.invalidateQueries({ queryKey: ['node-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['machine-status', factoryId, machineId] });
  }

  if (ctxQuery.isLoading) return <p className="py-8 text-center text-sm text-muted">{t('Loading…')}</p>;
  if (!ctx) {
    return <p className="py-8 text-center text-sm text-red-600">{ctxQuery.error instanceof Error ? ctxQuery.error.message : t('Something went wrong')}</p>;
  }

  if (mode === 'current') {
    const binding = ctx.current_bindings.find((b) => b.binding_id === bindingId) ?? ctx.current_bindings[0];
    if (binding) {
      return (
        <CurrentFlow
          factoryId={factoryId}
          ctx={ctx}
          binding={binding}
          onBack={() => setMode('choose')}
          onSaved={afterSave}
          onClose={onClose}
        />
      );
    }
  }
  if (mode === 'count') {
    return <CountFlow factoryId={factoryId} ctx={ctx} onBack={() => setMode('choose')} onSaved={afterSave} onClose={onClose} />;
  }

  return (
    <Choose
      ctx={ctx}
      bindingId={bindingId ?? ctx.current_bindings[0]?.binding_id ?? null}
      onBinding={setBindingId}
      onPick={setMode}
      locale={locale}
      tr={{ t, tn: () => '', locale }}
    />
  );
}

// ── Step 0: what to calibrate ─────────────────────────────────────────────────────────────────

function Choose({
  ctx,
  bindingId,
  onBinding,
  onPick,
  locale,
  tr,
}: {
  ctx: CalibrationContext;
  bindingId: string | null;
  onBinding: (id: string) => void;
  onPick: (mode: Mode) => void;
  locale: Locale;
  tr: Pick<Translator, 't'> & { locale: Locale; tn: unknown };
}) {
  const { t } = tr;
  const hasCurrent = ctx.current_bindings.length > 0;
  const hasCycle = ctx.cycle_bindings.length > 0;
  const last = ctx.recent[0];
  const defaults = ctx.type_defaults;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('What do you want to calibrate?')}</p>
      {last && (
        <p className="text-xs text-muted">{t('Last calibrated {date}', { date: formatDateTime(last.created_at, locale) })}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          icon={<Activity className="h-5 w-5" />}
          title={t('Running / stopped detection')}
          body={t('Measure the machine off, idling and running; the dashboard learns where "running" begins.')}
          disabledReason={hasCurrent ? null : t('No current sensor is mapped to this machine yet.')}
          onClick={() => onPick('current')}
        />
        <ChoiceCard
          icon={<Gauge className="h-5 w-5" />}
          title={t('Production count')}
          body={t("Compare the sensor's pulses with the machine's own counter over one run.")}
          disabledReason={hasCycle ? null : t('No proximity sensor is mapped to this machine yet.')}
          onClick={() => onPick('count')}
        />
      </div>
      {ctx.current_bindings.length > 1 && (
        <Field label={t('Sensor channel')}>
          <select
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            value={bindingId ?? ''}
            onChange={(e) => onBinding(e.target.value)}
          >
            {ctx.current_bindings.map((b) => (
              <option key={b.binding_id} value={b.binding_id}>
                {b.label} · {b.device_id} {b.channel_slot}
              </option>
            ))}
          </select>
        </Field>
      )}
      {defaults?.on_threshold_a != null && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
          {t('Machines of type {type} use {on} A running / {off} A off.', {
            type: defaults.type,
            on: formatDecimal(defaults.on_threshold_a, 2, locale),
            off: defaults.off_below_a != null ? formatDecimal(defaults.off_below_a, 2, locale) : '—',
          })}
        </p>
      )}
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  body,
  disabledReason,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  disabledReason: string | null;
  onClick: () => void;
}) {
  const disabled = disabledReason !== null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary hover:bg-blue-50/40 active:bg-blue-50',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary">{icon}</span>
      <span className="text-base font-semibold text-foreground">{title}</span>
      <span className="text-sm text-muted">{body}</span>
      {disabledReason && <span className="text-xs text-amber-700">{disabledReason}</span>}
    </button>
  );
}

// ── Measuring one level ──────────────────────────────────────────────────────────────────────

function useLevelSamples(factoryId: string, bindingId: string, since: string | null) {
  return useQuery({
    queryKey: ['calibration-current-samples', factoryId, bindingId, since],
    queryFn: ({ signal }) => api.calibrationCurrentSamples(factoryId, { binding_id: bindingId, since: since as string }, { signal }),
    enabled: Boolean(since),
    refetchInterval: POLL_MS,
    staleTime: 0,
  });
}

function MeasureLevel({
  factoryId,
  binding,
  level,
  stepNo,
  onDone,
  onSkip,
  onBack,
}: {
  factoryId: string;
  binding: CalibrationCurrentBinding;
  level: Level;
  stepNo: number;
  onDone: (summary: LevelSummary | null) => void;
  onSkip?: () => void;
  onBack: () => void;
}) {
  const { t, locale } = useT();
  const [since, setSince] = useState<string | null>(null);
  const samples = useLevelSamples(factoryId, binding.binding_id, since);
  const windows = samples.data?.windows ?? [];
  const summary = summarizeWindows(windows);
  const status = stepStatus(windows.length, WINDOWS_WANTED);
  const progress = Math.min(100, (status.have / status.want) * 100);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t(LEVEL_TITLE[level], { n: stepNo })}</h3>
        <p className="mt-1 text-sm text-muted">{t(LEVEL_INSTRUCTION[level])}</p>
        <p className="mt-1 text-xs text-muted">{binding.label} · {binding.device_id} {binding.channel_slot}</p>
      </div>

      {!since ? (
        <Button className="w-full sm:w-auto" onClick={() => setSince(new Date().toISOString())}>{t('Start')}</Button>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm font-medium">{t(status.phrase, { have: status.have, want: status.want })}</p>
          <p className="text-xs text-muted">{t('Minutes measured: {have} / {want}', { have: status.have, want: status.want })}</p>
          {summary && (
            <p className="text-sm tabular-nums">
              {t('Average {a} A · lowest {min} A · highest {max} A', {
                a: formatDecimal(summary.mean_a, 2, locale),
                min: formatDecimal(summary.min_a, 2, locale),
                max: formatDecimal(summary.max_a, 2, locale),
              })}
            </p>
          )}
          {samples.isError && <p className="text-xs text-red-600">{(samples.error as Error).message}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}>{t('Back')}</Button>
        {onSkip && <Button variant="secondary" onClick={onSkip}>{t('This machine has no idle state')}</Button>}
        {since && !status.ready && summary && (
          <Button variant="secondary" onClick={() => onDone(summary)}>{t('Use what we have')}</Button>
        )}
        <Button className="ml-auto" disabled={!status.ready || !summary} onClick={() => onDone(summary)}>{t('Next')}</Button>
      </div>
    </div>
  );
}

// ── The current flow: off → idle → running → result → saved ──────────────────────────────────

function CurrentFlow({
  factoryId,
  ctx,
  binding,
  onBack,
  onSaved,
  onClose,
}: {
  factoryId: string;
  ctx: CalibrationContext;
  binding: CalibrationCurrentBinding;
  onBack: () => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t, tn, locale } = useT();
  const [stepIndex, setStepIndex] = useState(0);   // 0..2 measuring, 3 result
  const [levels, setLevels] = useState<Record<Level, LevelSummary | null>>({ off: null, idle: null, running: null });
  const [on, setOn] = useState<string>('');
  const [offBelow, setOffBelow] = useState<string>('');
  const [applyToType, setApplyToType] = useState(false);
  const [machineType, setMachineType] = useState(ctx.machine.type ?? '');
  const [proposal, setProposal] = useState<ReturnType<typeof proposeThresholds> | null>(null);
  const [saved, setSaved] = useState<SaveCurrentCalibrationResponse | null>(null);

  const save = useMutation({
    mutationFn: () => api.saveCurrentCalibration(factoryId, binding.binding_id, {
      on_threshold_a: Number(on),
      off_below_a: offBelow.trim() === '' ? null : Number(offBelow),
      levels: { off_a: levels.off?.mean_a ?? null, idle_a: levels.idle?.mean_a ?? null, running_a: levels.running?.mean_a ?? null },
      machine_type: machineType.trim() || null,
      apply_to_type: applyToType,
    }),
    onSuccess: (res) => {
      setSaved(res);
      onSaved();
    },
  });

  function finishLevel(level: Level, summary: LevelSummary | null) {
    const next = { ...levels, [level]: summary };
    setLevels(next);
    if (level === 'running') {
      const p = proposeThresholds(next);
      setProposal(p);
      setOn(p.on_threshold_a != null ? String(p.on_threshold_a) : '');
      setOffBelow(p.off_below_a != null ? String(p.off_below_a) : '');
      setStepIndex(3);
    } else {
      setStepIndex(stepIndex + 1);
    }
  }

  if (saved) {
    const push = saved.board_push;
    let pushText: string | null = null;
    if (push) {
      switch (push.status) {
        case 'sent': pushText = t('Sent to board {board_id}.', { board_id: push.board_id }); break;
        case 'firmware-too-old': pushText = t('Board {board_id} needs a firmware update to use its own threshold.', { board_id: push.board_id }); break;
        case 'not-a-managed-board': pushText = t('This sensor is not on a board managed from the dashboard: its own threshold is unchanged.'); break;
        case 'broker-unavailable': pushText = t('The broker is unavailable: the board gets the new threshold when the server can reach it.'); break;
        default: pushText = t('Could not reach the board: {error}', { error: push.error ?? '' });
      }
    }
    return (
      <div className="space-y-4" role="status">
        <p className="text-base font-semibold text-emerald-700">{t('Saved.')}</p>
        <p className="text-sm">
          {t('Running threshold {on} A', { on: formatDecimal(saved.binding.on_threshold_a ?? Number(on), 2, locale) })}
          {saved.binding.off_below_a != null && ` · ${t('off threshold {off} A', { off: formatDecimal(saved.binding.off_below_a, 2, locale) })}`}
        </p>
        {pushText && <p className="text-sm text-muted">{pushText}</p>}
        {saved.applied_to > 1 && <p className="text-sm text-muted">{tn(saved.applied_to, 'Applied to {count} machine.', 'Applied to {count} machines.')}</p>}
        <Button onClick={onClose}>{t('Done')}</Button>
      </div>
    );
  }

  if (stepIndex < 3) {
    const level = LEVELS[stepIndex];
    return (
      <MeasureLevel
        key={level}
        factoryId={factoryId}
        binding={binding}
        level={level}
        stepNo={stepIndex + 1}
        onDone={(s) => finishLevel(level, s)}
        onSkip={level === 'idle' ? () => finishLevel('idle', null) : undefined}
        onBack={() => (stepIndex === 0 ? onBack() : setStepIndex(stepIndex - 1))}
      />
    );
  }

  const onNum = Number(on);
  const offNum = offBelow.trim() === '' ? null : Number(offBelow);
  const valid = Number.isFinite(onNum) && onNum > 0 && (offNum === null || (Number.isFinite(offNum) && offNum >= 0 && offNum < onNum));
  const board = binding.board;
  const fmt = (s: LevelSummary | null) => (s
    ? t('{a} A (lowest {min}, highest {max})', { a: formatDecimal(s.mean_a, 2, locale), min: formatDecimal(s.min_a, 2, locale), max: formatDecimal(s.max_a, 2, locale) })
    : t('not measured'));

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('Measured levels')}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {LEVELS.map((lv) => (
          <div key={lv} className="contents">
            <dt className="text-muted">{t(LEVEL_WORD[lv])}</dt>
            <dd className="tabular-nums">{fmt(levels[lv])}</dd>
          </div>
        ))}
      </dl>
      {proposal?.warnings.map((w) => (
        <p key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t(w, { gap: proposal.gap_a != null ? formatDecimal(proposal.gap_a, 2, locale) : '' })}
        </p>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Running threshold (A)')}>
          <Input type="number" step="0.01" min="0.01" value={on} onChange={(e) => setOn(e.target.value)} />
          <p className="mt-1 text-xs text-muted">{t('Above this the machine counts as running.')}</p>
        </Field>
        <Field label={t('Off threshold (A)')}>
          <Input type="number" step="0.01" min="0" value={offBelow} onChange={(e) => setOffBelow(e.target.value)} placeholder="—" />
          <p className="mt-1 text-xs text-muted">{t('Below this the machine counts as switched off; between the two it idles. Leave empty for no distinction.')}</p>
        </Field>
      </div>
      {board && (
        <p className="text-xs text-muted">
          {board.online === false ? t('Board {board_id}: offline', { board_id: board.board_id }) : t('Board {board_id}: online', { board_id: board.board_id })}
          {board.fw ? ` · ${t('firmware {fw}', { fw: board.fw })}` : ''}
        </p>
      )}
      {board && !board.per_channel_thresholds && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t('Board {board_id} runs firmware {fw}: it uses one threshold for all its channels until it is updated to 2.6.0 or later. The dashboard uses these values regardless.', { board_id: board.board_id, fw: board.fw ?? '?' })}
        </p>
      )}
      <div className="space-y-2 rounded-2xl border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={applyToType} onChange={(e) => setApplyToType(e.target.checked)} />
          {tn(ctx.machines_of_type || 1, 'Apply to all {count} machine of this type', 'Apply to all {count} machines of this type')}
        </label>
        <Field label={t('Machine type')}>
          <Input value={machineType} onChange={(e) => setMachineType(e.target.value)} placeholder={t('e.g. Rapier loom, CNC lathe')} />
        </Field>
      </div>
      {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setStepIndex(0)}>{t('Measure again')}</Button>
        <Button className="ml-auto" disabled={!valid || save.isPending || (applyToType && !machineType.trim())} onClick={() => save.mutate()}>
          {save.isPending ? t('Saving…') : t('Save')}
        </Button>
      </div>
    </div>
  );
}

// ── The count flow ───────────────────────────────────────────────────────────────────────────

function CountFlow({
  factoryId,
  ctx,
  onBack,
  onSaved,
  onClose,
}: {
  factoryId: string;
  ctx: CalibrationContext;
  onBack: () => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t, tn, locale } = useT();
  const machineId = ctx.machine.machine_id;
  const [since, setSince] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [units, setUnits] = useState('');
  const [unitLabel, setUnitLabel] = useState(ctx.machine.unit_label ?? '');
  const [applyToType, setApplyToType] = useState(false);
  const [saved, setSaved] = useState<{ per_unit: number; applied_to: number } | null>(null);

  const samples = useQuery({
    queryKey: ['calibration-count-samples', factoryId, machineId, since],
    queryFn: ({ signal }) => api.calibrationCountSamples(factoryId, { machine_id: machineId, since: since as string }, { signal }),
    enabled: Boolean(since),
    refetchInterval: entering ? false : POLL_MS,
    staleTime: 0,
  });
  const pulses = samples.data?.pulses ?? 0;
  const windows = samples.data?.windows ?? 0;
  const unitsNum = Number(units);
  const unitWord = unitLabel.trim() || t('units');
  const comparison = unitsNum > 0 ? countComparison(pulses, unitsNum, ctx.machine.rotations_per_unit) : null;

  const save = useMutation({
    mutationFn: () => api.saveCountCalibration(factoryId, machineId, {
      pulses,
      units: unitsNum,
      unit_label: unitLabel.trim() || null,
      apply_to_type: applyToType,
    }),
    onSuccess: (res) => {
      setSaved({ per_unit: res.rotations_per_unit, applied_to: res.applied_to });
      onSaved();
    },
  });

  if (saved) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-base font-semibold text-emerald-700">
          {t('Saved. 1 {unit} = {per_unit} pulses.', { unit: unitWord, per_unit: formatUpTo(saved.per_unit, 4, locale) })}
        </p>
        {saved.applied_to > 1 && <p className="text-sm text-muted">{tn(saved.applied_to, 'Applied to {count} machine.', 'Applied to {count} machines.')}</p>}
        <Button onClick={onClose}>{t('Done')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t('Production count')}</h3>
        <p className="mt-1 text-sm text-muted">
          {t("Note the machine's own counter (pieces or metres) now, then press Start. Run the machine normally for at least 10 minutes: the longer, the more exact.")}
        </p>
      </div>

      {!since ? (
        <Button className="w-full sm:w-auto" onClick={() => setSince(new Date().toISOString())}>{t('Start')}</Button>
      ) : (
        <div className="space-y-2 rounded-2xl border bg-slate-50 p-4 text-sm">
          <p className="font-medium tabular-nums">{t('Pulses so far: {pulses}', { pulses })}</p>
          <p className="text-muted">{t('Minutes measured: {minutes}', { minutes: windows })}</p>
          <p className="text-muted tabular-nums">
            {t('Your current setting would report {units} {unit}.', { units: formatUpTo(samples.data?.units ?? 0, 2, locale), unit: unitWord })}
          </p>
          {samples.isError && <p className="text-xs text-red-600">{(samples.error as Error).message}</p>}
        </div>
      )}

      {since && !entering && (
        <Button variant="secondary" disabled={pulses <= 0} onClick={() => setEntering(true)}>{t('Stop and enter the count')}</Button>
      )}

      {entering && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Units produced since Start')}>
              <Input type="number" step="any" min="0" value={units} onChange={(e) => setUnits(e.target.value)} autoFocus />
              <p className="mt-1 text-xs text-muted">{t("Enter what the machine's counter advanced by since Start.")}</p>
            </Field>
            <Field label={t('Unit')}>
              <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="m" maxLength={16} />
            </Field>
          </div>
          {comparison?.new_per_unit != null && (
            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium tabular-nums">
                {t('New setting: 1 {unit} = {per_unit} pulses', { unit: unitWord, per_unit: formatUpTo(comparison.new_per_unit, 4, locale) })}
              </p>
              {comparison.change_pct != null && Math.abs(comparison.change_pct) >= 0.1 && (
                <p className="text-muted tabular-nums">
                  {t('Your current setting would have shown {units_now} {unit} instead of {units} ({pct}% off).', {
                    units_now: formatUpTo(comparison.units_now, 2, locale), unit: unitWord, units: formatUpTo(unitsNum, 2, locale),
                    pct: formatUpTo(Math.abs(comparison.change_pct), 1, locale),
                  })}
                </p>
              )}
            </div>
          )}
          {windows < 10 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t('Only {minutes} minutes measured: the result can be off by about {err}%.', { minutes: windows, err: formatInt(countErrorPct(windows), locale) })}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={applyToType} onChange={(e) => setApplyToType(e.target.checked)} disabled={!ctx.machine.type} />
            {tn(ctx.machines_of_type || 1, 'Apply to all {count} machine of this type', 'Apply to all {count} machines of this type')}
            {!ctx.machine.type && <span className="text-xs text-muted">({t('this machine has no type yet')})</span>}
          </label>
          {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}>{t('Back')}</Button>
        {entering && (
          <Button className="ml-auto" disabled={!(unitsNum > 0) || pulses <= 0 || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t('Saving…') : t('Save')}
          </Button>
        )}
      </div>
    </div>
  );
}
