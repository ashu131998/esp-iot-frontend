'use client';

import { useMemo } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DOW = ['S','M','T','W','T','F','S'];

export function buildGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const last  = endOfMonth(month);
  const cells: (Date | null)[] = Array(getDay(first)).fill(null);
  eachDayOfInterval({ start: first, end: last }).forEach(d => cells.push(d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthCalendar({
  label,
  month,
  onMonthChange,
  rangeStart,
  rangeEnd,
  hoverDate,
  onDayClick,
  onDayHover,
  minDate,
}: {
  label: string;
  month: Date;
  onMonthChange: (d: Date) => void;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  minDate?: Date | null;
}) {
  const today = useMemo(() => new Date(), []);
  const cells = useMemo(() => buildGrid(month), [month]);

  const effEnd   = rangeEnd ?? (rangeStart && hoverDate && !isBefore(hoverDate, rangeStart) ? hoverDate : null);
  const effStart = rangeStart && !rangeEnd && hoverDate && isBefore(hoverDate, rangeStart) ? hoverDate : rangeStart;

  const currentYear = today.getFullYear();
  const minYear = minDate ? minDate.getFullYear() : currentYear - 5;
  const years: number[] = [];
  for (let y = minYear; y <= currentYear; y++) years.push(y);

  const canGoBack    = !(month.getFullYear() === minYear && month.getMonth() === 0);
  const canGoForward = !(month.getFullYear() === currentYear && month.getMonth() === today.getMonth());

  return (
    <div className="w-[260px] select-none">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>

      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => canGoBack && onMonthChange(subMonths(month, 1))}
          disabled={!canGoBack}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>

        <div className="flex items-center gap-0.5 text-sm font-medium text-gray-700">
          <select
            value={month.getMonth()}
            onChange={e => onMonthChange(new Date(month.getFullYear(), +e.target.value, 1))}
            className="appearance-none bg-transparent cursor-pointer pr-1 focus:outline-none"
          >
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <ChevronDown className="h-3 w-3 text-gray-400 -ml-1 mr-1" />
          <select
            value={month.getFullYear()}
            onChange={e => onMonthChange(new Date(+e.target.value, month.getMonth(), 1))}
            className="appearance-none bg-transparent cursor-pointer pr-1 focus:outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="h-3 w-3 text-gray-400 -ml-1" />
        </div>

        <button
          type="button"
          onClick={() => canGoForward && onMonthChange(addMonths(month, 1))}
          disabled={!canGoForward}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map((d, i) => (
          <div key={i} className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-8" />;

          const isStart    = effStart != null && isSameDay(day, effStart);
          const isEnd      = effEnd   != null && isSameDay(day, effEnd);
          const hasRange   = effStart != null && effEnd != null;
          const inRange    = hasRange && isWithinInterval(day, { start: effStart!, end: effEnd! }) && !isStart && !isEnd;
          const isToday    = isSameDay(day, today);
          const inCurMonth = day.getMonth() === month.getMonth();
          const disabled   = (minDate != null && isBefore(day, minDate)) || day > today;
          const colIdx     = i % 7;

          const showBand   = inRange || (isStart && hasRange) || (isEnd && hasRange);
          const bandLeft   = isStart && hasRange ? '50%' : '0%';
          const bandRight  = isEnd   && hasRange ? '50%' : '0%';
          const bandRoundL = (isStart && hasRange) || (inRange && colIdx === 0);
          const bandRoundR = (isEnd   && hasRange) || (inRange && colIdx === 6);

          return (
            <div key={i} className="relative h-8 flex items-center justify-center">
              {showBand && (
                <div
                  className={cn(
                    'absolute inset-y-1 bg-blue-50',
                    bandRoundL && 'rounded-l-full',
                    bandRoundR && 'rounded-r-full',
                  )}
                  style={{ left: bandLeft, right: bandRight }}
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onDayClick(day)}
                onMouseEnter={() => !disabled && onDayHover(day)}
                onMouseLeave={() => onDayHover(null)}
                className={cn(
                  'relative z-10 w-7 h-7 flex items-center justify-center rounded-full text-[13px] transition-colors',
                  inCurMonth ? 'text-gray-800' : 'text-gray-300',
                  disabled && 'cursor-not-allowed opacity-40',
                  !disabled && !isStart && !isEnd && 'hover:bg-gray-100',
                  (isStart || isEnd) && 'bg-blue-600 text-white font-semibold',
                  isToday && !isStart && !isEnd && 'ring-1 ring-blue-400 text-blue-600 font-medium',
                )}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
