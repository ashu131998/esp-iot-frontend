'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Camera, Droplets, Settings2 } from 'lucide-react';
import { useState } from 'react';

import { BottleBoxEditor } from '@/components/factory/bottle-box-editor';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { StatGridSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { ListEmpty, ListGroup, SummaryCard, TONE_DOT, type Tone } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  LEVEL_TONE, bottleEventsQueryKey, bottleWords, bottlesQueryKey, cameraTitle, eventWords, levelWord, pictureKindWord,
  pictureUrl, rectToFrac, summaryWords, type Bottle, type BottleCamera, type LevelEvent, type LevelState,
} from '@/lib/bottles';
import { useLineName, useShown } from '@/lib/factory-refs-context';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import { useBottleSnap } from '@/lib/use-bottle-snap';
import { cn } from '@/lib/utils';

const REFRESH_MS = 15_000;
const BAR_FILL: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-400',
  bad: 'bg-red-500',
  idle: 'bg-gray-300',
};
const BOX_BORDER: Record<LevelState, string> = {
  ok: 'border-emerald-400',
  low: 'border-amber-400',
  missing: 'border-red-500',
  unknown: 'border-white/80',
};
const pct = (f: number) => `${(f * 100).toFixed(2)}%`;

/**
 * Bottles: the dye bottles the factory's cameras watch — the sentence to read first, then each camera
 * with its last picture (the boxes drawn on it, coloured by state) and a bar per bottle, then the
 * changes each camera reported with the pictures it took. Admins draw the boxes and name the colours.
 */
export function BottlesDashboard({ factoryId }: { factoryId: string }) {
  return (
    <QuerySuspense fallback={<StatGridSkeleton count={2} />}>
      <BottlesOverview factoryId={factoryId} />
    </QuerySuspense>
  );
}

export function BottlesOverview({ factoryId }: { factoryId: string }) {
  const { t, tn } = useT();
  const shown = useShown();
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: bottlesQueryKey(factoryId),
    queryFn: ({ signal }) => api.bottles(factoryId, { signal }),
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
        icon={words.badge === undefined && words.tone !== 'good' ? <Droplets className="h-5 w-5" /> : undefined}
        title={words.title}
        subtitle={words.subtitle}
      />
      {data.cameras.length === 0 && (
        <Card>
          <CardHeader title={t('Setting up a dye camera')} />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>{t('Fix the camera in front of the bottles, with the white backlight behind them, and give it 24 V.')}</li>
            <li>{t('Our staff claim it into this factory from the Boards page; it shows here within a minute.')}</li>
            <li>{t('Draw a box around each bottle on its picture and name the colour. Done.')}</li>
          </ol>
        </Card>
      )}
      {shown('bottles.levels') && data.cameras.map((camera) => (
        <CameraCard key={camera.board_id} factoryId={factoryId} camera={camera} />
      ))}
      {shown('bottles.pictures') && data.cameras.map((camera) => (
        <CameraChanges key={camera.board_id} factoryId={factoryId} camera={camera} />
      ))}
    </div>
  );
}

/** One camera: where it is and whether it is on, its last picture with the boxes, a bar per bottle. */
function CameraCard({ factoryId, camera }: { factoryId: string; camera: BottleCamera }) {
  const { t, locale } = useT();
  const lineName = useLineName();
  const { canWriteFactory } = useAuth();
  const [editing, setEditing] = useState(false);
  const snap = useBottleSnap(factoryId, camera);
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
        action={canWriteFactory ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!camera.online || snap.pending || snap.waiting} onClick={snap.take}>
              <Camera className="mr-1.5 h-4 w-4" />
              {snap.waiting ? t('Taking a picture…') : t('Take a picture')}
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              {t('Bottles & settings')}
            </Button>
          </div>
        ) : undefined}
      />
      {trouble && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('The camera module reports a fault: {word}. Check that the camera ribbon is seated.', { word: trouble })}
        </p>
      )}
      {snap.error && <p className="mb-3 text-sm text-red-600">{snap.error.message}</p>}
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PictureWithBoxes factoryId={factoryId} camera={camera} />
        <div className="space-y-4">
          {camera.bottles.length === 0 ? (
            <p className="text-sm text-muted">
              {t('No bottles drawn yet. Open Bottles & settings and draw a box around each bottle on the picture.')}
            </p>
          ) : camera.bottles.map((bottle) => <BottleBar key={bottle.slot} bottle={bottle} />)}
          {!camera.machine_id && camera.bottles.length > 0 && canWriteFactory && (
            <p className="text-xs text-muted">{t('At no machine yet: pick one in Bottles & settings so its operators get the alerts.')}</p>
          )}
        </div>
      </div>
      {editing && <BottleBoxEditor factoryId={factoryId} camera={camera} onClose={() => setEditing(false)} />}
    </Card>
  );
}

/** The camera's last picture with each bottle's box over it, coloured by its state. */
export function PictureWithBoxes({ factoryId, camera }: { factoryId: string; camera: BottleCamera }) {
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
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        {/* The JPEG is behind the sign-in on our own API: next/image's optimizer could not fetch it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pictureUrl(factoryId, camera.board_id, picture.id)}
          alt={t("The camera's last picture")}
          width={picture.width ?? camera.settings.ref_w}
          height={picture.height ?? camera.settings.ref_h}
          className="block h-auto w-full"
        />
        {camera.bottles.map((b) => {
          const f = rectToFrac(b.box, camera.settings);
          return (
            <div
              key={b.slot}
              className={cn('absolute rounded-sm border-2', BOX_BORDER[b.state])}
              style={{ left: pct(f.x), top: pct(f.y), width: pct(f.w), height: pct(f.h) }}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/60 px-1 text-[10px] leading-4 text-white">{b.name}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        {pictureKindWord(picture.kind, t)} · {formatDateTime(picture.taken_at, locale)}
      </figcaption>
    </figure>
  );
}

/** One bottle: its name, a bar of its level with the refill line marked, and what its state means. */
function BottleBar({ bottle }: { bottle: Bottle }) {
  const { t, locale } = useT();
  const tone = LEVEL_TONE[bottle.state];
  const fill = bottle.state === 'missing' || bottle.percent == null ? 0 : Math.max(0, Math.min(100, bottle.percent));
  const value = bottle.state === 'unknown' || bottle.state === 'missing' || bottle.percent == null
    ? levelWord(bottle.state, t)
    : `${Math.round(bottle.percent)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[tone])} />
          <span className="truncate">{bottle.name}</span>
          <span className="text-xs font-normal text-muted">{bottle.slot}</span>
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      </div>
      <div
        className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
        aria-label={bottle.name}
      >
        <div className={cn('h-full rounded-full', BAR_FILL[tone])} style={{ width: `${fill}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-slate-500/70" style={{ left: `${bottle.low}%` }} title={t('Refill line: {percent}%', { percent: bottle.low })} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {bottleWords(bottle, t)}
        {bottle.at ? ` · ${formatDateTime(bottle.at, locale)}` : ''}
      </p>
    </div>
  );
}

/** What a camera reported, newest first, each change with the picture it took. */
function CameraChanges({ factoryId, camera }: { factoryId: string; camera: BottleCamera }) {
  const { t } = useT();
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data } = useQuery({
    queryKey: bottleEventsQueryKey(factoryId, camera.board_id),
    queryFn: ({ signal }) => api.bottleEvents(factoryId, camera.board_id, { limit: 30 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const events = data?.events ?? [];
  return (
    <ListGroup
      title={t('Changes · {camera}', { camera: cameraTitle(camera, t) })}
      count={data ? events.length : undefined}
      hint={t('Alert pictures are kept 30 days')}
    >
      {events.length === 0
        ? <ListEmpty>{data ? t('No changes yet: nothing ran low or went missing.') : t('Loading…')}</ListEmpty>
        : events.map((e) => <ChangeRow key={e.id} factoryId={factoryId} boardId={camera.board_id} event={e} />)}
    </ListGroup>
  );
}

function ChangeRow({ factoryId, boardId, event }: { factoryId: string; boardId: string; event: LevelEvent }) {
  const { t, locale } = useT();
  const tone = LEVEL_TONE[event.state];
  const href = event.picture_id ? pictureUrl(factoryId, boardId, event.picture_id) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_DOT[tone])} />
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
