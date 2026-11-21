'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { AlertCameraCard } from '@/components/alerts-app/alert-camera';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TONE_DOT } from '@/components/ui/simple';
import { AlertsApiError, alertsApi } from '@/lib/alerts-app/api';
import { ALERTS_QUERY_KEY, alertQueryKey, asksQuestion, cameraOf, optionsOf, severityTone, typeLabel } from '@/lib/alerts-app/model';
import { alertWords, reasonWords } from '@/lib/alerts-app/view';
import { useAppHref } from '@/lib/alerts-app/queries';
import type { AlertOption, MyAlert } from '@/lib/alerts-app/types';
import { formatFullDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/**
 * One alert: what happened, where and when, and the answers it asks for; a camera's, its picture and
 * the camera live; marked read on opening.
 */
export function AlertDetail({ id }: { id: string }) {
  const tr = useT();
  const { t } = tr;
  const href = useAppHref();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: alertQueryKey(id),
    queryFn: ({ signal }) => alertsApi.alert(id, signal),
    retry: false,
  });
  const alert = query.data;

  // Opening the alert reads it: once per alert, without waiting.
  const readSent = useRef<string | null>(null);
  const { mutate: sendRead } = useMutation({
    mutationFn: () => alertsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY }),
  });
  useEffect(() => {
    if (alert && !alert.read_at && readSent.current !== alert.notification_id) {
      readSent.current = alert.notification_id;
      sendRead();
    }
  }, [alert, sendRead]);

  const [answer, setAnswer] = useState<{ label: string; ack: string | null } | null>(null);
  const reply = useMutation({
    mutationFn: (option: AlertOption) => alertsApi.reply(id, option.id),
    onSuccess: (result, option) => {
      setAnswer({ label: result.resolution || option.label, ack: result.message ?? null });
      void queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: alertQueryKey(id) });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: alertQueryKey(id) });
    },
  });

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.isError || !alert) {
    const gone = query.error instanceof AlertsApiError && query.error.status === 404;
    return (
      <div className="space-y-4">
        <BackLink href={href('/')} label={t('Back to inbox')} />
        <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-sm ring-1 ring-gray-100">
          <p className="font-medium text-foreground">{gone ? t('This alert is not here any more.') : t('Something went wrong')}</p>
          {!gone && <Button variant="secondary" className="mt-4" onClick={() => query.refetch()}>{t('Try again')}</Button>}
        </div>
      </div>
    );
  }

  const options = optionsOf(alert);
  const answered = answer?.label ?? alert.resolution;
  const open = asksQuestion(alert) && !answer;
  const replyError = reply.error instanceof AlertsApiError ? reply.error : null;
  const words = alertWords(alert, tr);
  const isReason = alert.payload?.kind === 'downtime_reason';
  const camera = cameraOf(alert);

  return (
    <div className="space-y-4">
      <BackLink href={href('/')} label={t('Back to inbox')} />

      <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
          <span className={cn('h-2.5 w-2.5 rounded-full', TONE_DOT[severityTone(alert)])} />
          <KindLabel alert={alert} />
        </p>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-foreground">{words.title}</h1>
        {(alert.machine_name || alert.factory_name) && (
          <p className="mt-1 text-sm text-muted">{[alert.machine_name, alert.factory_name].filter(Boolean).join(' · ')}</p>
        )}
        <p className="mt-0.5 text-sm text-muted">{formatFullDateTime(alert.created_at, 'en')}</p>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{words.body ?? alert.message}</p>
      </article>

      {camera && <AlertCameraCard alertId={alert.notification_id} camera={camera} />}

      {(open || answered) && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-foreground">{t('Your answer')}</h2>
          {open && !words.body && alert.payload?.prompt && <p className="mt-1 text-sm text-muted">{String(alert.payload.prompt)}</p>}
          {open ? (
            <div className="mt-3 grid gap-2">
              {options.map((option) => (
                <Button
                  key={option.id}
                  variant="secondary"
                  className="h-12 justify-start px-4 text-base"
                  disabled={reply.isPending}
                  onClick={() => reply.mutate(option)}
                >
                  {isReason ? reasonWords(option.label, t) : option.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{t('Answered: {answer}', { answer: isReason && answered ? reasonWords(answered, t) : answered })}</span>
            </p>
          )}
          {answer?.ack && <p className="mt-2 text-sm text-muted">{answer.ack}</p>}
          {reply.isPending && <p className="mt-2 text-sm text-muted" role="status">{t('Sending…')}</p>}
          {reply.isError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {replyError?.status === 409 ? t('Someone already answered this one.') : t('Could not send your answer. Try again.')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** What kind of alert it is, in the person's language. */
function KindLabel({ alert }: { alert: Pick<MyAlert, 'type'> }) {
  const { t } = useT();
  switch (typeLabel(alert.type)) {
    case 'Machine stopped': return <span>{t('Machine stopped')}</span>;
    case 'Machine running again': return <span>{t('Machine running again')}</span>;
    case 'Shift reminder': return <span>{t('Shift reminder')}</span>;
    case 'Camera': return <span>{t('Camera')}</span>;
    case 'Test alert': return <span>{t('Test alert')}</span>;
    default: return <span>{t('Alert')}</span>;
  }
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
