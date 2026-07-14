'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  addMonths,
  endOfDay,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subHours,
  subMonths,
} from 'date-fns';
import { shiftWindow } from '@/lib/shifts';
import { Calendar, ChevronDown, Clock, Loader2, Search, X } from 'lucide-react';

import { MonthCalendar } from '@/components/ui/date-range-calendar';
import { RefreshCountdown } from '@/components/uptime/refresh-countdown';
import { useIsNavigating, useNavigate } from '@/lib/navigation-context';
import {
  DATE_PARAM_FROM,
  DATE_PARAM_TO,
  isLiveRange,
  resolveDateRange,
} from '@/lib/date-range';
import { useRefreshInfo } from '@/lib/refresh-context';
import type { Machine, ProductionLine } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Last 24 Hours', getDates: () => { const n = new Date(); return { from: subHours(n, 24), to: n }; } },
  { label: 'Today',         getDates: () => { const n = new Date(); return { from: startOfDay(n), to: n }; } },
  { label: 'Last 3 Days',   getDates: () => { const n = new Date(); return { from: startOfDay(subDays(n, 3)), to: n }; } },
  { label: 'Last 7 Days',   getDates: () => { const n = new Date(); return { from: startOfDay(subDays(n, 7)), to: n }; } },
  { label: 'Last 10 Days',  getDates: () => { const n = new Date(); return { from: startOfDay(subDays(n, 10)), to: n }; } },
  { label: 'Last 3 Months', getDates: () => { const n = new Date(); return { from: startOfDay(subMonths(n, 3)), to: n }; } },
  { label: 'Day Shift',     getDates: () => shiftWindow('A') },
  { label: 'Night Shift',   getDates: () => shiftWindow('B') },
];

// ── DateRangePicker ──────────────────────────────────────────────────────────

export function DateRangePicker({
  minDate,
  className,
  from,
  to,
  machineId,
  machines,
  lines,
  hideDateRange = false,
}: {
  minDate?: string | null;
  className?: string;
  from?: string;
  to?: string;
  machineId?: string;
  machines?: Machine[];
  lines?: ProductionLine[];
  hideDateRange?: boolean;
}) {
  const pathname   = usePathname();
  const navigate   = useNavigate();
  const isNavigating = useIsNavigating();
  const refreshInfo = useRefreshInfo();

  // Machine selector state
  const [machineOpen,   setMachineOpen]   = useState(false);
  const [machineSearch, setMachineSearch] = useState('');

  // Calendar panel state
  const [open,         setOpen]         = useState(false);
  const [draftFrom,    setDraftFrom]    = useState<Date | null>(null);
  const [draftTo,      setDraftTo]      = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selecting,    setSelecting]    = useState<'start' | 'end'>('start');
  const [hoverDate,    setHoverDate]    = useState<Date | null>(null);
  const [fromMonth,    setFromMonth]    = useState<Date>(startOfMonth(new Date()));
  const [toMonth,      setToMonth]      = useState<Date>(startOfMonth(addMonths(new Date(), 1)));

  // Time-of-day state
  const [draftFromTime, setDraftFromTime] = useState('00:00');
  const [draftToTime,   setDraftToTime]   = useState('23:59');

  const panelRef   = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const minDateObj = useMemo(() => {
    if (!minDate) return null;
    const d = parseISO(minDate);
    return isNaN(d.getTime()) ? null : startOfDay(d);
  }, [minDate]);

  const liveNow = !to ? (refreshInfo?.lastUpdatedAt ?? 0) : 0;

  const current = useMemo(
    () => resolveDateRange({ from, to }, minDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, minDate, liveNow],
  );

  const lineMap = useMemo(
    () => Object.fromEntries((lines ?? []).map(l => [l.line_id, l.name])),
    [lines],
  );

  const selectedMachine = useMemo(
    () => (machines ?? []).find(m => m.machine_id === machineId),
    [machines, machineId],
  );

  const filteredMachines = useMemo(() => {
    const q = machineSearch.toLowerCase().trim();
    return q ? (machines ?? []).filter(m => m.name.toLowerCase().includes(q)) : (machines ?? []);
  }, [machines, machineSearch]);

  const groupedMachines = useMemo(() => {
    const groups: Record<string, Machine[]> = {};
    for (const m of filteredMachines) {
      if (!groups[m.line_id]) groups[m.line_id] = [];
      groups[m.line_id].push(m);
    }
    return groups;
  }, [filteredMachines]);

  const push = useCallback(
    (params: URLSearchParams) => {
      const s = params.toString();
      navigate(s ? `${pathname}?${s}` : pathname);
    },
    [navigate, pathname],
  );

  const applyRange = useCallback(
    (fromDate: Date, toDate: Date, dateOnly = false) => {
      const params = new URLSearchParams();
      if (dateOnly) {
        params.set(DATE_PARAM_FROM, format(fromDate, 'yyyy-MM-dd'));
        params.set(DATE_PARAM_TO,   format(toDate,   'yyyy-MM-dd'));
      } else {
        params.set(DATE_PARAM_FROM, format(fromDate, "yyyy-MM-dd'T'HH:mm"));
        if (!isLiveRange(toDate.toISOString())) {
          params.set(DATE_PARAM_TO, format(toDate, "yyyy-MM-dd'T'HH:mm"));
        }
      }
      if (machineId) params.set('machine_id', machineId);
      push(params);
    },
    [machineId, push],
  );

  const applyMachine = useCallback(
    (newMachineId: string | undefined) => {
      const params = new URLSearchParams();
      if (from) params.set(DATE_PARAM_FROM, from);
      if (to)   params.set(DATE_PARAM_TO,   to);
      if (newMachineId) params.set('machine_id', newMachineId);
      push(params);
      setMachineOpen(false);
      setMachineSearch('');
    },
    [from, to, push],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPanel = () => {
    const f = parseISO(current.from);
    const t = parseISO(current.to);
    setDraftFrom(startOfDay(f));
    setDraftTo(endOfDay(t));
    setFromMonth(startOfMonth(f));
    setToMonth(startOfMonth(isSameDay(startOfMonth(f), startOfMonth(t)) ? addMonths(t, 1) : t));
    setActivePreset(null);
    setSelecting('start');
    setHoverDate(null);
    setDraftFromTime(format(f, 'HH:mm'));
    setDraftToTime(format(t, 'HH:mm'));
    setOpen(true);
  };

  const handleDayClick = (day: Date) => {
    if (selecting === 'start') {
      setDraftFrom(startOfDay(day));
      setDraftTo(null);
      setSelecting('end');
      setActivePreset(null);
    } else {
      if (draftFrom && isBefore(day, draftFrom)) {
        setDraftTo(endOfDay(draftFrom));
        setDraftFrom(startOfDay(day));
      } else {
        setDraftTo(endOfDay(day));
      }
      setSelecting('start');
      setActivePreset(null);
    }
  };

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    const { from: pf, to: pt } = preset.getDates();
    setDraftFrom(startOfDay(pf));
    setDraftTo(endOfDay(pt));
    setActivePreset(preset.label);
    setSelecting('start');
    setHoverDate(null);
    setFromMonth(startOfMonth(pf));
    setToMonth(startOfMonth(isSameDay(startOfMonth(pf), startOfMonth(pt)) ? addMonths(pt, 1) : pt));
    setDraftFromTime(format(pf, 'HH:mm'));
    setDraftToTime(format(pt, 'HH:mm'));
  };

  const handleClear = () => {
    // Reset to the app default: rolling last 24 hours.
    const now   = new Date();
    const start = subHours(now, 24);
    setDraftFrom(startOfDay(start));
    setDraftTo(endOfDay(now));
    setActivePreset('Last 24 Hours');
    setSelecting('start');
    setHoverDate(null);
    setFromMonth(startOfMonth(start));
    setToMonth(addMonths(startOfMonth(start), 1));
    setDraftFromTime(format(start, 'HH:mm'));
    setDraftToTime(format(now, 'HH:mm'));
  };

  const timeCutoff  = startOfDay(subDays(new Date(), 3));
  const timeDisabled = !!draftFrom && draftFrom < timeCutoff;

  const handleApply = () => {
    if (draftFrom && draftTo) {
      if (timeDisabled) {
        applyRange(startOfDay(draftFrom), endOfDay(draftTo), true);
      } else {
        const fromDate = new Date(draftFrom);
        const toDate   = new Date(draftTo);
        const [fh, fm] = draftFromTime.split(':').map(Number);
        const [th, tm] = draftToTime.split(':').map(Number);
        fromDate.setHours(fh, fm, 0, 0);
        toDate.setHours(th, tm, 59, 999);
        applyRange(fromDate, toDate);
      }
    }
    setOpen(false);
  };

  const rangeStart = draftFrom && !draftTo && hoverDate && isBefore(hoverDate, draftFrom)
    ? hoverDate : draftFrom;
  const rangeEnd   = draftTo ?? (draftFrom && hoverDate && !isBefore(hoverDate, draftFrom) ? hoverDate : null);

  const triggerLabel = `${format(parseISO(current.from), 'd MMM yyyy, HH:mm')} → ${format(parseISO(current.to), 'd MMM yyyy, HH:mm')}`;
  const showMachines = machines && machines.length > 0;

  return (
    <div className={cn('relative flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100', className)}>

      {/* Date range trigger */}
      {!hideDateRange && (
        <button
          ref={triggerRef}
          type="button"
          onClick={openPanel}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 hover:border-gray-300"
        >
          <Calendar className="h-4 w-4 shrink-0 text-muted" />
          <span className="font-medium text-foreground">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      )}

      {/* Machine selector */}
      {showMachines && (
        <>
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMachineOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                'border-input bg-background hover:bg-accent',
                machineId && 'border-primary/50 bg-primary/5',
              )}
            >
              <span className="font-medium text-muted">Machine</span>
              <span className={cn('max-w-[120px] truncate font-medium', machineId ? 'text-primary' : 'text-foreground')}>
                {selectedMachine ? selectedMachine.name : 'All'}
              </span>
              {machineId ? (
                <span
                  role="button"
                  aria-label="Clear machine filter"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10"
                  onClick={e => { e.stopPropagation(); applyMachine(undefined); }}
                >
                  <X className="h-3 w-3 text-primary" />
                </span>
              ) : (
                <ChevronDown className="h-3 w-3 text-muted" />
              )}
            </button>

            {machineOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setMachineOpen(false); setMachineSearch(''); }} />
                <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border bg-white shadow-lg">
                  <div className="border-b p-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
                      <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search machines…"
                        className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
                        value={machineSearch}
                        onChange={e => setMachineSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={() => applyMachine(undefined)}
                      className={cn('w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent', !machineId && 'bg-accent font-medium')}
                    >
                      All Machines
                    </button>
                    {Object.entries(groupedMachines).map(([lineId, lineMs]) => (
                      <div key={lineId}>
                        <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {lineMap[lineId] ?? lineId}
                        </p>
                        {lineMs.map(m => (
                          <button
                            key={m.machine_id}
                            type="button"
                            onClick={() => applyMachine(m.machine_id)}
                            className={cn('w-full px-5 py-1.5 text-left text-xs transition-colors hover:bg-accent', m.machine_id === machineId && 'bg-accent font-medium')}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    ))}
                    {filteredMachines.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted">No machines found</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Updating indicator */}
      {isNavigating && (
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </span>
      )}

      {/* Refresh countdown */}
      {refreshInfo && !isNavigating && (
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden h-5 w-px bg-border sm:block" />
          <RefreshCountdown lastUpdatedAt={refreshInfo.lastUpdatedAt} intervalSec={refreshInfo.intervalSec} />
        </div>
      )}

      {/* ── Calendar panel ───────────────────────────────────────────────── */}
      {open && !hideDateRange && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-50 mt-2 rounded-xl border bg-white shadow-2xl"
          style={{ minWidth: 660 }}
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
              {activePreset ?? 'Custom'}
            </span>
            <span className="text-sm text-gray-500">
              {draftFrom ? format(draftFrom, 'd MMMM yyyy') : '—'}
              {' → '}
              {draftTo   ? format(draftTo,   'd MMMM yyyy') : (selecting === 'end' ? 'pick end date' : '—')}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="ml-auto text-xs text-blue-500 underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!draftFrom || !draftTo}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Apply
            </button>
          </div>

          <div className="flex">
            <div className="w-36 shrink-0 border-r py-4">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    activePreset === preset.label
                      ? 'bg-blue-50 font-semibold text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col px-6">
              <div className="flex gap-6 py-4">
                <MonthCalendar
                  label="From"
                  month={fromMonth}
                  onMonthChange={setFromMonth}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                  minDate={minDateObj}
                />
                <div className="w-px bg-gray-100" />
                <MonthCalendar
                  label="To"
                  month={toMonth}
                  onMonthChange={setToMonth}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                  minDate={minDateObj}
                />
              </div>

              <div className="flex gap-6 border-t py-3">
                <div className="flex w-[260px] items-center gap-2 text-xs text-gray-600">
                  <Clock className={cn('h-3.5 w-3.5 shrink-0', timeDisabled ? 'text-gray-300' : 'text-gray-400')} />
                  <span className={cn('font-medium', timeDisabled ? 'text-gray-300' : 'text-gray-500')}>From time</span>
                  <input
                    type="time"
                    value={draftFromTime}
                    disabled={timeDisabled}
                    onChange={(e) => {
                      setDraftFromTime(e.target.value);
                      setActivePreset(null);
                    }}
                    className="ml-auto rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
                  />
                </div>
                <div className="w-px bg-gray-100" />
                <div className="flex w-[260px] items-center gap-2 text-xs text-gray-600">
                  <Clock className={cn('h-3.5 w-3.5 shrink-0', timeDisabled ? 'text-gray-300' : 'text-gray-400')} />
                  <span className={cn('font-medium', timeDisabled ? 'text-gray-300' : 'text-gray-500')}>To time</span>
                  <input
                    type="time"
                    value={draftToTime}
                    disabled={timeDisabled}
                    onChange={(e) => {
                      setDraftToTime(e.target.value);
                      setActivePreset(null);
                    }}
                    className="ml-auto rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
                  />
                </div>
              </div>

              {timeDisabled && (
                <p className="border-t py-2 text-[11px] text-amber-600">
                  Time-of-day filtering is unavailable for dates older than 3 days — only daily aggregates are stored for that period.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
