'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Camera as CameraIcon, Settings2, Video } from 'lucide-react';
import { useState } from 'react';

import { LiveSheet } from '@/components/cam/live-view';
import { CameraSettingsSheet } from '@/components/factory/camera-settings';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { ListEmpty, ListGroup, SummaryCard, TONE_DOT } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  EVENT_TONE, cameraEventsQueryKey, cameraTitle, camerasQueryKey, eventWords, pictureKindWord, pictureUrl, summaryWords,
  type Camera, type CameraEvent,
} from '@/lib/cameras';
import { useLineName } from '@/lib/factory-refs-context';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { useCameraSnap } from '@/lib/use-camera-snap';
import { cn } from '@/lib/utils';

const REFRESH_MS = 15_000;

/**
 * Cameras: the factory's cameras — the sentence to read first, then each camera with its last picture, its live view
 * and (for admins) a picture now and its settings, then what each saw (a truck, a hand) with the pictures.
 */
export function CamerasDashboard({ factoryId }: { factoryId: string }) {
  return (
    <QuerySuspense fallback={<StatGridSkeleton count={2} />}>
      <CamerasOverview factoryId={factoryId} />
    </QuerySuspense>
  );
}

export function CamerasOverview({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: camerasQueryKey(factoryId),
    queryFn: ({ signal }) => api.cameras(factoryId, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  useSetRefreshInfo(dataUpdatedAt, REFRESH_MS / 1000);
  const words = summaryWords(data.cameras, t, tn);

  return (
    <div className="space-y-6">
      <SummaryCard
        tone={words.tone}
        badge={words.badge}
        icon={words.badge === undefined && words.tone !== 'good' ? <CameraIcon className="h-5 w-5" /> : undefined}
        title={words.title}
        subtitle={words.subtitle}
      />
      {data.cameras.map((camera) => <CameraCard key={camera.board_id} factoryId={factoryId} camera={camera} />)}
      {data.cameras.map((camera) => <CameraEvents key={camera.board_id} factoryId={factoryId} camera={camera} />)}
    </div>
  );
}

/** One camera: where it is and whether it is on, its last picture, Watch live; for admins a picture now and its settings. */
function CameraCard({ factoryId, camera }: { factoryId: string; camera: Camera }) {
  const { t, locale } = useT();
  const lineName = useLineName();
  const { canWriteFactory } = useAuth();
  const [editing, setEditing] = useState(false);
  const [watching, setWatching] = useState(false);
  const snap = useCameraSnap(factoryId, camera);
  const status = camera.online
    ? t('Online')
    : camera.last_beat_at
      ? t('Offline since {time}', { time: formatDateTime(camera.last_beat_at, locale) })
      : t('Never heard from');
  const trouble = camera.online && camera.camera && camera.camera !== 'ok' ? camera.camera : null;

  return (
    <Card>
      <CardHeader
        title={cameraTitle(camera, t)}
        description={`${lineName(camera.line_id)} · ${status}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!camera.online} onClick={() => setWatching(true)}>
              <Video className="mr-1.5 h-4 w-4" />
              {t('Watch live')}
            </Button>
            {canWriteFactory && (
              <>
                <Button size="sm" variant="secondary" disabled={!camera.online || snap.pending || snap.waiting} onClick={snap.take}>
                  <CameraIcon className="mr-1.5 h-4 w-4" />
                  {snap.waiting ? t('Taking a picture…') : t('Take a picture')}
                </Button>
                <Button size="sm" onClick={() => setEditing(true)}>
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  {t('Settings')}
                </Button>
              </>
            )}
          </div>
        }
      />
      {camera.online && camera.view === 'blocked' && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{t('Something is in front of the camera right now.')}</p>
      )}
      {trouble && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('The camera module reports a fault: {word}. Check that the camera ribbon is seated.', { word: trouble })}
        </p>
      )}
      {snap.error && <p className="mb-3 text-sm text-red-600">{snap.error.message}</p>}
      <LastPicture factoryId={factoryId} camera={camera} />
      {!camera.view_alert && canWriteFactory && (
        <p className="mt-2 text-xs text-muted">{t('Its alert is switched off: what it sees is only listed below.')}</p>
      )}
      {editing && <CameraSettingsSheet factoryId={factoryId} camera={camera} onClose={() => setEditing(false)} />}
      {watching && (
        <LiveSheet scope={{ factoryId }} boardId={camera.board_id} title={cameraTitle(camera, t)} onClose={() => setWatching(false)} />
      )}
    </Card>
  );
}

/** The camera's last picture. */
export function LastPicture({ factoryId, camera }: { factoryId: string; camera: Camera }) {
  const { t, locale } = useT();
  const picture = camera.last_picture;
  if (!picture) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 px-4 text-center text-sm text-muted">
        {camera.online ? t('No picture yet: ask for one with Take a picture.') : t('No picture yet.')}
      </div>
    );
  }
  return (
    <figure>
      <div className="overflow-hidden rounded-xl bg-slate-900">
        {/* The JPEG is behind the sign-in on our own API: next/image's optimizer could not fetch it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pictureUrl(factoryId, camera.board_id, picture.id)}
          alt={t("The camera's last picture")}
          width={picture.width ?? 640}
          height={picture.height ?? 480}
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        {pictureKindWord(picture, t)} · {formatDateTime(picture.taken_at, locale)}
      </figcaption>
    </figure>
  );
}

/** What a camera saw, newest first: a truck, a hand (2.9.6: something in front of it, clear again), with its picture. */
function CameraEvents({ factoryId, camera }: { factoryId: string; camera: Camera }) {
  const { t } = useT();
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data } = useQuery({
    queryKey: cameraEventsQueryKey(factoryId, camera.board_id),
    queryFn: ({ signal }) => api.cameraEvents(factoryId, camera.board_id, { limit: 30 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const events = data?.events ?? [];
  return (
    <ListGroup
      title={t('What it saw · {camera}', { camera: cameraTitle(camera, t) })}
      count={data ? events.length : undefined}
      hint={t('Pictures are kept 30 days')}
    >
      {events.length === 0
        ? <ListEmpty>{data ? t('Nothing yet: it has not seen a truck or a hand.') : t('Loading…')}</ListEmpty>
        : events.map((e) => <EventRow key={e.id} factoryId={factoryId} boardId={camera.board_id} event={e} />)}
    </ListGroup>
  );
}

function EventRow({ factoryId, boardId, event }: { factoryId: string; boardId: string; event: CameraEvent }) {
  const { t, locale } = useT();
  const href = event.picture_id ? pictureUrl(factoryId, boardId, event.picture_id) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[EVENT_TONE(event)])} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{eventWords(event, t)}</p>
        <p className="text-sm text-muted">{formatDateTime(event.occurred_at, locale)}</p>
      </div>
      {href && (
        <a href={href} target="_blank" rel="noopener" className="shrink-0" title={t('Open the picture')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt="" loading="lazy" className="h-12 w-16 rounded-md object-cover ring-1 ring-gray-200" />
        </a>
      )}
    </div>
  );
}
