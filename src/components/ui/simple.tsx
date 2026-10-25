import { CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Plain, phone-style building blocks for factory-floor pages: one big status
 * line, a few big numbers, and grouped lists of tappable rows.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'idle';

export const TONE_DOT: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-400',
  bad: 'bg-red-500',
  idle: 'bg-gray-300',
};

const TONE_BUBBLE: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  idle: 'bg-gray-400',
};

const TONE_SOFT: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-600',
  warn: 'bg-amber-50 text-amber-600',
  bad: 'bg-red-50 text-red-600',
  idle: 'bg-slate-100 text-slate-600',
};

/**
 * The one sentence a person should read first. `badge` shows a number in a
 * coloured circle, `icon` a symbol for numbers that are neither good nor bad;
 * with neither, a check mark.
 */
export function SummaryCard({
  tone,
  badge,
  icon,
  title,
  subtitle,
}: {
  tone: Tone;
  badge?: string | number;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
      {icon ? (
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', TONE_SOFT[tone])}>
          {icon}
        </span>
      ) : badge === undefined ? (
        <CheckCircle2 className={cn('h-10 w-10 shrink-0', tone === 'good' ? 'text-emerald-500' : 'text-gray-400')} />
      ) : (
        <span
          className={cn(
            'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-lg font-bold text-white',
            TONE_BUBBLE[tone],
          )}
        >
          {badge}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Big numbers in a row of rounded tiles. */
export function NumberTiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function NumberTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-gray-100">
      <p className="flex items-center gap-2 text-sm font-medium text-muted">
        {tone && <span className={cn('h-2.5 w-2.5 rounded-full', TONE_DOT[tone])} />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** A titled, rounded list. Rows go inside as children. */
export function ListGroup({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-sm font-semibold text-foreground">
          {title}
          {count !== undefined && <span className="font-normal text-muted"> · {count}</span>}
        </h3>
        {(hint || action) && (
          <span className="flex items-center gap-3 text-xs text-muted">
            {hint}
            {action}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        {children}
      </div>
    </section>
  );
}

/** One row: coloured dot, name (+ small tag), one plain sentence, an optional big value, and a chevron when it links somewhere. */
export function ListRow({
  href,
  tone,
  title,
  tag,
  detail,
  value,
  valueHint,
  extra,
}: {
  href?: string;
  tone?: Tone;
  title: string;
  tag?: string;
  detail?: React.ReactNode;
  value?: string;
  valueHint?: string;
  extra?: React.ReactNode;
}) {
  const body = (
    <>
      {tone && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[tone])} />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {title}
          {tag && <span className="ml-2 text-sm font-normal text-muted">{tag}</span>}
        </p>
        {detail && <p className="truncate text-sm text-muted">{detail}</p>}
      </div>
      {extra && <div className="hidden shrink-0 md:block">{extra}</div>}
      {value !== undefined && (
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold tabular-nums text-foreground">{value}</span>
          {valueHint && <span className="block text-[11px] text-muted">{valueHint}</span>}
        </span>
      )}
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
    </>
  );
  const cls = 'flex items-center gap-3 px-4 py-3.5';
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:bg-gray-50 active:bg-gray-100')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Shown inside a ListGroup when it has nothing to list. */
export function ListEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
