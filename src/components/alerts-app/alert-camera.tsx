'use client';

import { useQuery } from '@tanstack/react-query';
import { Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LiveStream } from '@/components/cam/live-view';
import { Button } from '@/components/ui/button';
import { alertPictureUrl, alertsApi } from '@/lib/alerts-app/api';
import type { AlertCamera } from '@/lib/alerts-app/model';
import { useT } from '@/lib/i18n/context';
import { liveRefusal } from '@/lib/live';

/**
 * A camera alert in the app (the user, 2026-11-21: "in the camera alert i want image as well as check
 * camera within the app"): the picture sent with the alert, and the camera live on a tap, in the app
 * itself, without the dashboard's Cameras page. The live view runs only while it is open (it uses the
 * factory's internet), as on the Cameras page.
 */
export function AlertCameraCard({ alertId, camera }: { alertId: string; camera: AlertCamera }) {
  const { t } = useT();
  const [watching, setWatching] = useState(false);
  // On a phone the live view opens below the picture: brought into sight, clear of the top and bottom bars.
  const liveCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (watching) liveCard.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [watching]);
  return (
    <section className="space-y-3">
      {camera.picture && <AlertPicture alertId={alertId} />}
      {watching ? (
        <div ref={liveCard} className="scroll-mb-24 scroll-mt-20 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t('Live view')}</h2>
            <Button variant="ghost" size="sm" onClick={() => setWatching(false)}>{t('Close')}</Button>
          </div>
          <AlertLive alertId={alertId} />
        </div>
      ) : (
        <Button className="h-12 w-full text-base" onClick={() => setWatching(true)}>
          <Video className="mr-2 h-5 w-5" aria-hidden="true" />
          {t('Check camera')}
        </Button>
      )}
    </section>
  );
}

/** The picture sent with the alert; a plain line when it is not there (an alert from before pictures came with them). */
function AlertPicture({ alertId }: { alertId: string }) {
  const { t } = useT();
  const [state, setState] = useState<'loading' | 'shown' | 'missing'>('loading');
  const img = useRef<HTMLImageElement>(null);
  // A picture the phone already had may finish before the page listens for it.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? 'shown' : 'missing');
  }, []);

  if (state === 'missing') {
    return (
      <p className="rounded-2xl bg-white px-5 py-4 text-sm text-muted shadow-sm ring-1 ring-gray-100">
        {t('The picture of this alert is not available.')}
      </p>
    );
  }
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element -- the alert's own picture, behind the sign-in; no optimiser on Workers */}
      <img
        ref={img}
        src={alertPictureUrl(alertId)}
        alt={t('The camera\'s picture of this alert')}
        className="block aspect-[4/3] w-full object-contain"
        onLoad={() => setState('shown')}
        onError={() => setState('missing')}
      />
      {state === 'loading' && (
        <figcaption className="absolute inset-0 flex items-center justify-center text-sm text-white/80" role="status">
          {t('Loading the picture…')}
        </figcaption>
      )}
    </figure>
  );
}

/** The camera live: started once each session (a fresh link each time), its frames counted while it plays. */
function AlertLive({ alertId }: { alertId: string }) {
  const { t } = useT();
  const [session, setSession] = useState(0);
  const start = useQuery({
    queryKey: ['me-alert-live', alertId, session],
    queryFn: () => alertsApi.startLive(alertId),
    retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const status = useQuery({
    queryKey: ['me-alert-live-status', alertId],
    queryFn: ({ signal }) => alertsApi.liveStatus(alertId, signal),
    enabled: start.isSuccess,
    refetchInterval: 3_000,
  });

  // The stream's own shape while it starts (components/cam/live-view.tsx LiveStream: the picture, its status
  // line, the note): nothing jumps when it comes, and the card scrolls into sight whole.
  if (start.isPending) {
    return (
      <div className="space-y-3">
        <p className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-black text-sm text-white/80" role="status">
          {t('Starting the camera…')}
        </p>
        <p className="h-5" aria-hidden="true" />
        <p className="text-xs text-muted">{t('It streams only while this is open, so the factory\'s internet is not used up.')}</p>
      </div>
    );
  }
  if (start.isError) {
    const why = liveRefusal(start.error);
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="alert">
        {why === 'update-firmware'
          ? t('Update the camera to firmware 2.9.5 for the live view.')
          : why === 'offline' ? t('The camera is offline: the live view works once it is back.') : start.error.message}
      </p>
    );
  }
  return (
    <LiveStream
      key={session} src={start.data.stream} sessionS={start.data.session_s} fps={status.data?.fps ?? 0}
      onAgain={() => setSession(session + 1)}
    />
  );
}
