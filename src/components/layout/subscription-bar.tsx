'use client';

import { useAuth } from '@/lib/auth-context';
import { formatFullDate } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { SALES_EMAIL, dayAsInstant, subscriptionBar, type SubscriptionStatus } from '@/lib/subscriptions';
import { cn } from '@/lib/utils';

/**
 * The factory dashboard's subscription bar (lib/subscriptions.ts subscriptionBar decides who
 * sees it): red once the subscription has ended, saying the data stops at its end and nothing
 * is lost; amber in its last 30 days for those who can renew. Both say how to renew.
 */
export function SubscriptionBar({ status }: { status?: SubscriptionStatus | null }) {
  const { t, locale } = useT();
  const { isInternalStaff, canWriteFactory } = useAuth();
  const bar = subscriptionBar(status, { staff: isInternalStaff, canRenew: canWriteFactory });
  if (!bar) return null;

  const date = formatFullDate(dayAsInstant(bar.ends_on), locale);
  const email = (
    <a href={`mailto:${SALES_EMAIL}`} className="font-semibold underline underline-offset-2">{SALES_EMAIL}</a>
  );
  let text: string;
  if (bar.kind === 'ended') {
    text = t('Your FloorBeat subscription ended on {date}. You can see your data up to that day; everything recorded since is kept and appears again once you renew.', { date });
  } else if (bar.kind === 'ended-staff') {
    text = t("This factory's subscription ended on {date}. Its users see data up to that day; you see everything.", { date });
  } else if (bar.days_left <= 0) {
    text = t('Your FloorBeat subscription ends today.');
  } else if (bar.days_left === 1) {
    text = t('Your FloorBeat subscription ends tomorrow, {date}.', { date });
  } else {
    text = t('Your FloorBeat subscription ends on {date}, in {n} days.', { date, n: bar.days_left });
  }
  const renew = bar.kind !== 'ended-staff';
  return (
    <div
      role="status"
      className={cn(
        'border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8 print:hidden',
        bar.kind === 'ending' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900',
      )}
    >
      {text}
      {renew && (
        <>
          {' '}
          {t('To renew, write to')} {email}.
        </>
      )}
    </div>
  );
}
