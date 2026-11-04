import { subscriptionBadge, type BadgeTone, type SubscriptionStatus } from '@/lib/subscriptions';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  bad: 'bg-red-50 text-red-700 ring-red-200',
  idle: 'bg-slate-100 text-slate-700 ring-slate-200',
};

/** Where a factory's subscription stands, as a pill: "Ends in 5 days (1 Dec 2026)", "Ended 1 Dec 2026". */
export function SubscriptionBadge({ status, className }: { status?: SubscriptionStatus | null; className?: string }) {
  const badge = subscriptionBadge(status);
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1', TONE_CLASS[badge.tone], className)}>
      {badge.label}
    </span>
  );
}
