'use client';

import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import { liveRefusal, type LiveScope } from '@/lib/live';

/** A camera's live view in a pop-up: it streams while open; closing it stops the camera soon after. */
export function LiveSheet({ scope, boardId, title, onClose }: { scope: LiveScope; boardId: string; title: string; onClose: () => void }) {
  return (
    <Sheet title={title} size="lg" onClose={onClose}>
      <LiveView scope={scope} boardId={boardId} />
    </Sheet>
  );
}

/** Starts the camera, plays its stream, says whether frames arrive; after the session, Keep watching. */
export function LiveView({ scope, boardId }: { scope: LiveScope; boardId: string }) {
  const { t } = useT();
  const [session, setSession] = useState(0);
  const where = scope?.factoryId ?? 'ops';
  // Each session asks the server once (it starts the camera, or keeps it going) for a fresh link.
  const start = useQuery({
    queryKey: ['live-start', where, boardId, session],
    queryFn: () => api.startLive(scope, boardId),
    retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const status = useQuery({
    queryKey: ['live-status', where, boardId],
    queryFn: ({ signal }) => api.liveStatus(scope, boardId, { signal }),
    enabled: start.isSuccess,
    refetchInterval: 3_000,
  });

  if (start.isPending) return <p className="text-sm text-muted">{t('Starting the camera…')}</p>;
  if (start.isError) {
    const why = liveRefusal(start.error);
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        {why === 'update-firmware'
          ? t('Update the camera to firmware 2.9.5 for the live view.')
          : why === 'offline' ? t('The camera is offline: the live view works once it is back.') : (start.error as Error).message}
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

export function LiveStream({ src, sessionS, fps, onAgain }: { src: string; sessionS: number; fps: number; onAgain: () => void }) {
  const { t } = useT();
  const [seen, setSeen] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnded(true), sessionS * 1000);
    return () => clearTimeout(timer);
  }, [sessionS]);
  const flowing = fps > 0;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        {ended ? (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-white/90">
            <p>{t('Paused after {count} minutes to save the factory\'s internet.', { count: Math.round(sessionS / 60) })}</p>
            <Button size="sm" onClick={onAgain}>
              <Play className="mr-1.5 h-4 w-4" />
              {t('Keep watching')}
            </Button>
          </div>
        ) : (
          <>
            {/* An MJPEG stream: a plain <img> plays it in every browser (next/image cannot). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={t('Live view')} className="block aspect-[4/3] w-full object-contain" onLoad={() => setSeen(true)} />
            {!seen && !flowing && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">{t('Waiting for the camera…')}</p>
            )}
          </>
        )}
      </div>
      {!ended && (
        <p className="flex items-center gap-2 text-sm">
          {flowing ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden />
              {t('Live · {fps} a second', { fps: String(fps) })}
            </>
          ) : (
            <span className="text-muted">{t('Waiting for the camera…')}</span>
          )}
        </p>
      )}
      <p className="text-xs text-muted">{t('It streams only while this is open, so the factory\'s internet is not used up.')}</p>
    </div>
  );
}
