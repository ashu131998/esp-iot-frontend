'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellOff, ChevronRight, CircleHelp } from 'lucide-react';
import Link from 'next/link';

import { PushPrompt } from '@/components/alerts-app/push-prompt';
import { usePushSwitch } from '@/components/alerts-app/use-push-switch';
import { InboxSkeleton } from '@/components/alerts-app/skeletons';
import { Button } from '@/components/ui/button';
import { ListGroup, SummaryCard, TONE_DOT } from '@/components/ui/simple';
import { alertsApi } from '@/lib/alerts-app/api';
import { ALERTS_QUERY_KEY, asksQuestion, dayLabel, factoriesIn, groupAlerts, severityTone, whereLabel } from '@/lib/alerts-app/model';
import { alertWords } from '@/lib/alerts-app/view';
import { useAppHref, useMyAlerts } from '@/lib/alerts-app/queries';
import type { MyAlert } from '@/lib/alerts-app/types';
import { dayKeyToDate, formatDayMonth, formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

/** The inbox: how many are new, the open questions first, then every alert by day. */
export function AlertsInbox() {
  const { t, tn, locale } = useT();
  const href = useAppHref();
  const queryClient = useQueryClient();
  const alerts = useMyAlerts();
  const push = usePushSwitch();
  const readAll = useMutation({
    mutationFn: () => alertsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY }),
  });

  if (alerts.isPending) return <InboxSkeleton />;
  if (alerts.isError) {
    return (
      <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-sm ring-1 ring-gray-100">
        <p className="font-medium text-foreground">{t('Could not load your alerts.')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => alerts.refetch()}>{t('Try again')}</Button>
      </div>
    );
  }

  const { items, unread } = alerts.data;
  const groups = groupAlerts(items);
  const many = factoriesIn(items) > 1;
  const now = new Date();

  return (
    <div className="space-y-5">
      <PushPrompt state={push.state} busy={push.busy} failed={push.note === 'enable-failed'} onEnable={push.enable} installHref={href('/install')} />

      {unread > 0 ? (
        <SummaryCard tone="bad" badge={unread} title={tn(unread, '{count} new alert', '{count} new alerts')} subtitle={t('Tap an alert to read it.')} />
      ) : (
        <SummaryCard tone="good" title={t('All caught up')} subtitle={push.state === 'on' ? t('New alerts show here and ring your phone.') : t('New alerts show here.')} />
      )}

      {unread > 0 && (
        <div className="-mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            {t('Mark all as read')}
          </Button>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-2xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-gray-100">
          <BellOff className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
          <p className="mt-3 font-medium text-foreground">{t('No alerts yet')}</p>
          <p className="mt-1 text-sm text-muted">{t('When a machine stops or a shift starts, you will see it here.')}</p>
        </div>
      )}

      {groups.needsAnswer.length > 0 && (
        <ListGroup title={t('Needs your answer')} count={groups.needsAnswer.length}>
          {groups.needsAnswer.map((a) => (
            <AlertRow key={a.notification_id} alert={a} href={href(`/alerts/${encodeURIComponent(a.notification_id)}`)} many={many} locale={locale} />
          ))}
        </ListGroup>
      )}

      {groups.days.map((day) => {
        const label = dayLabel(day.key, now);
        const title = label === 'Today' ? t('Today') : label === 'Yesterday' ? t('Yesterday') : formatDayMonth(dayKeyToDate(day.key), locale);
        return (
          <ListGroup key={day.key} title={title} count={day.items.length}>
            {day.items.map((a) => (
              <AlertRow key={a.notification_id} alert={a} href={href(`/alerts/${encodeURIComponent(a.notification_id)}`)} many={many} locale={locale} />
            ))}
          </ListGroup>
        );
      })}
    </div>
  );
}

/** One alert: its colour, its title (bold while unread), where it is from, when; a question mark while it waits for an answer. */
function AlertRow({ alert, href, many, locale }: { alert: MyAlert; href: string; many: boolean; locale: Locale }) {
  const tr = useT();
  const { t } = tr;
  const unread = !alert.read_at;
  const where = whereLabel(alert, many);
  const { title } = alertWords(alert, tr);
  return (
    <Link
      href={href}
      // The alert's page fetched ahead once its row is on screen: a tap shows it at once, from the inbox's own
      // copy of the alert (alert-detail.tsx), then checks it with the server.
      prefetch
      className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 active:bg-gray-100', unread && 'bg-orange-50/50')}
    >
      <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 self-start rounded-full', TONE_DOT[severityTone(alert)])} />
      <div className="min-w-0 flex-1">
        {/* The whole title, on two lines if it needs them: a phone must never cut "Loom 3 is DOWN" short. */}
        <p className={cn('line-clamp-2 leading-snug text-foreground', unread ? 'font-semibold' : 'font-medium')}>
          {unread && <span className="sr-only">{t('Unread')}: </span>}
          {title}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted">
          <span className="tabular-nums">{formatTime(alert.created_at, locale)}</span>
          {where && <span> · {where}</span>}
        </p>
      </div>
      {asksQuestion(alert) && <CircleHelp className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
    </Link>
  );
}
