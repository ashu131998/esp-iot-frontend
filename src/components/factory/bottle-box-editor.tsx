'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import {
  CAM_MAX_BOXES, boxProblem, bottlesQueryKey, cleanBoxes, fracToPoint, hitBox, hitCorner, moveRect, newBox, nextSlot,
  pictureKindWord, pictureUrl, rectFromDrag, rectToFrac, resizeRect, settingsProblem,
  type BottleCamera, type CamBox, type EditableSettings, type Rect,
} from '@/lib/bottles';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { useBottleSnap } from '@/lib/use-bottle-snap';
import { cn } from '@/lib/utils';

type Pt = { x: number; y: number };
type Drag =
  | { kind: 'draw'; start: Pt; now: Pt }
  | { kind: 'move'; index: number; start: Pt; origin: Rect }
  | { kind: 'resize'; index: number };

/** How far from a box's corner a finger or pointer still grabs it, on the screen. */
const GRIP_PX = 14;
const pct = (f: number) => `${(f * 100).toFixed(2)}%`;
const editable = (s: BottleCamera['settings']): EditableSettings => ({
  period_s: s.period_s, need: s.need, pic_every_s: s.pic_every_s, dark: s.dark, bright: s.bright, flip: s.flip, mirror: s.mirror,
});

/**
 * Where a camera's bottles are set up: a box drawn around each bottle on the camera's picture (drag
 * to draw, drag a box to move it, its corner to resize it), the colour's name and its refill line,
 * the machine the bottles are at, and the camera's own settings. Saved to the camera in one go.
 */
export function BottleBoxEditor({ factoryId, camera, onClose }: { factoryId: string; camera: BottleCamera; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('Bottles & settings')} onClose={onClose} size="lg">
      <BottleBoxForm factoryId={factoryId} camera={camera} onClose={onClose} />
    </Sheet>
  );
}

export function BottleBoxForm({ factoryId, camera, onClose }: { factoryId: string; camera: BottleCamera; onClose: () => void }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const { machines } = useFactoryRefs();
  const ref = camera.settings;
  const [boxes, setBoxes] = useState<CamBox[]>(() => camera.bottles.map((b) => ({ slot: b.slot, name: b.name, ...b.box, low: b.low, cap: b.cap })));
  const [selected, setSelected] = useState(-1);
  const [machineId, setMachineId] = useState(camera.machine_id ?? '');
  const [settings, setSettings] = useState<EditableSettings>(() => editable(camera.settings));
  const [problem, setProblem] = useState<string | null>(null);
  const snap = useBottleSnap(factoryId, camera);
  const picture = camera.last_picture;

  const save = useMutation({
    mutationFn: () => api.saveBottleSettings(factoryId, camera.board_id, {
      cam: { ...camera.settings, ...settings, boxes: cleanBoxes(boxes) },
      machine_id: machineId || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bottlesQueryKey(factoryId) });
      onClose();
    },
    onError: (err: Error) => setProblem(err.message),
  });
  const trouble = boxProblem(boxes, ref, t) ?? settingsProblem(settings, t);
  const sortedMachines = [...machines].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const patch = (i: number, change: Partial<CamBox>) => setBoxes((list) => list.map((b, j) => (j === i ? { ...b, ...change } : b)));
  const remove = (i: number) => {
    setBoxes((list) => list.filter((_, j) => j !== i));
    setSelected(-1);
  };
  const number = (v: string) => (v.trim() === '' ? NaN : Number(v));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (trouble || save.isPending) return;
        save.mutate();
      }}
    >
      <div className="space-y-2">
        {picture ? (
          <DrawSurface
            src={pictureUrl(factoryId, camera.board_id, picture.id)}
            ref_w={ref.ref_w}
            ref_h={ref.ref_h}
            boxes={boxes}
            selected={selected}
            onSelect={setSelected}
            onChange={setBoxes}
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-100 px-4 text-center text-sm text-muted">
            {t('Ask the camera for a picture to draw on.')}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {picture ? `${pictureKindWord(picture.kind, t)} · ${formatDateTime(picture.taken_at)}` : ''}
          </span>
          <Button type="button" size="sm" variant="secondary" disabled={!camera.online || snap.pending || snap.waiting} onClick={snap.take}>
            <Camera className="mr-1.5 h-4 w-4" />
            {snap.waiting ? t('Taking a picture…') : t('Take a picture')}
          </Button>
        </div>
        <p className="text-sm text-muted">
          {t("Drag on the picture to draw a box from the bottle's bottom to above its cap. Drag a box to move it, its corner to resize it.")}
          {' '}
          {t('Up to {count} bottles.', { count: CAM_MAX_BOXES })}
        </p>
      </div>

      {boxes.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-100">
          {boxes.map((b, i) => (
            <li
              key={b.slot}
              className={cn('flex flex-wrap items-center gap-2 px-3 py-2', i === selected && 'bg-sky-50')}
              onClick={() => setSelected(i)}
            >
              <span className="w-7 text-xs font-semibold text-muted">{b.slot}</span>
              <Input
                aria-label={t('Colour name')}
                value={b.name}
                maxLength={23}
                placeholder={t('Colour, e.g. Red')}
                className="min-w-32 flex-1"
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                {t('Refill line')}
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={Number.isNaN(b.low) ? '' : b.low}
                  className="w-16"
                  onChange={(e) => patch(i, { low: number(e.target.value) })}
                />
                %
              </label>
              <Button type="button" size="sm" variant="ghost" aria-label={t('Remove')} onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Field label={t('Machine the bottles are at')}>
        <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">{t('No machine: email alerts only')}</option>
          {sortedMachines.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>{m.name}</option>
          ))}
        </Select>
        <p className="text-xs text-muted">{t('Its operators get a low or missing bottle on their phone, with the picture.')}</p>
      </Field>

      <details className="rounded-xl ring-1 ring-gray-100">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{t('Camera settings')}</summary>
        <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
          <Field label={t('Measure every (seconds)')}>
            <Input type="number" inputMode="numeric" min={1} max={3600} value={settings.period_s} onChange={(e) => setSettings({ ...settings, period_s: number(e.target.value) })} />
          </Field>
          <Field label={t('Readings that must agree')}>
            <Input type="number" inputMode="numeric" min={1} max={20} value={settings.need} onChange={(e) => setSettings({ ...settings, need: number(e.target.value) })} />
          </Field>
          <Field label={t('Routine picture every (seconds, 0 for none)')}>
            <Input type="number" inputMode="numeric" min={0} max={86400} value={settings.pic_every_s} onChange={(e) => setSettings({ ...settings, pic_every_s: number(e.target.value) })} />
          </Field>
          <div className="flex items-end gap-4 pb-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.flip} onChange={(e) => setSettings({ ...settings, flip: e.target.checked })} />
              {t('Upside down')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.mirror} onChange={(e) => setSettings({ ...settings, mirror: e.target.checked })} />
              {t('Mirrored')}
            </label>
          </div>
          <Field label={t('Dark threshold (0–255)')}>
            <Input type="number" inputMode="numeric" min={0} max={255} value={settings.dark} onChange={(e) => setSettings({ ...settings, dark: number(e.target.value) })} />
          </Field>
          <Field label={t('Backlight threshold (0–255)')}>
            <Input type="number" inputMode="numeric" min={0} max={255} value={settings.bright} onChange={(e) => setSettings({ ...settings, bright: number(e.target.value) })} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">
            {t('Liquid shows darker than the dark threshold against a backlight brighter than the backlight threshold. Change these only when a full bottle reads wrong.')}
          </p>
        </div>
      </details>

      {(trouble ?? problem) && <p className="text-sm text-red-600">{trouble ?? problem}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" disabled={Boolean(trouble) || save.isPending}>
          {save.isPending ? t('Sending…') : t('Send to camera')}
        </Button>
      </div>
    </form>
  );
}

/** The picture with the boxes over it: drag on it to draw a box, drag a box to move it, its corner to resize it. */
function DrawSurface({ src, ref_w, ref_h, boxes, selected, onSelect, onChange }: {
  src: string;
  ref_w: number;
  ref_h: number;
  boxes: CamBox[];
  selected: number;
  onSelect: (index: number) => void;
  onChange: (boxes: CamBox[]) => void;
}) {
  const { t } = useT();
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const ref = { ref_w, ref_h };

  const pointAt = (e: React.PointerEvent): Pt => {
    const r = surface.current!.getBoundingClientRect();
    return fracToPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, ref);
  };
  const grip = (): number => {
    const r = surface.current!.getBoundingClientRect();
    return Math.round((GRIP_PX * ref_w) / Math.max(1, r.width));
  };
  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    surface.current?.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    const corner = hitCorner(boxes, p, grip());
    if (corner >= 0) {
      onSelect(corner);
      setDrag({ kind: 'resize', index: corner });
      return;
    }
    const hit = hitBox(boxes, p);
    if (hit >= 0) {
      onSelect(hit);
      setDrag({ kind: 'move', index: hit, start: p, origin: boxes[hit] });
      return;
    }
    if (nextSlot(boxes)) setDrag({ kind: 'draw', start: p, now: p });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointAt(e);
    if (drag.kind === 'draw') {
      setDrag({ ...drag, now: p });
    } else if (drag.kind === 'move') {
      const moved = moveRect(drag.origin, p.x - drag.start.x, p.y - drag.start.y, ref);
      onChange(boxes.map((b, i) => (i === drag.index ? { ...b, ...moved } : b)));
    } else {
      onChange(boxes.map((b, i) => (i === drag.index ? { ...b, ...resizeRect(b, p, ref) } : b)));
    }
  };
  const up = () => {
    if (drag?.kind === 'draw') {
      const rect = rectFromDrag(drag.start, drag.now, ref);
      const box = rect ? newBox(boxes, rect) : null;
      if (box) {
        onChange([...boxes, box]);
        onSelect(boxes.length);
      }
    }
    setDrag(null);
  };
  const drawing = drag?.kind === 'draw' ? rectFromDrag(drag.start, drag.now, ref) : null;

  return (
    <div
      ref={surface}
      className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-slate-900"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t("The camera's last picture")} width={ref_w} height={ref_h} draggable={false} className="pointer-events-none block h-auto w-full" />
      {boxes.map((b, i) => {
        const f = rectToFrac(b, ref);
        return (
          <div
            key={b.slot}
            className={cn('absolute border-2', i === selected ? 'border-sky-400 bg-sky-400/10' : 'border-white/80')}
            style={{ left: pct(f.x), top: pct(f.y), width: pct(f.w), height: pct(f.h) }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-black/60 px-1 text-[10px] leading-4 text-white">{b.name || b.slot}</span>
            <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm bg-white ring-1 ring-sky-500" />
          </div>
        );
      })}
      {drawing && (
        <div
          className="absolute border-2 border-dashed border-sky-300"
          style={{ left: pct(drawing.x / ref_w), top: pct(drawing.y / ref_h), width: pct(drawing.w / ref_w), height: pct(drawing.h / ref_h) }}
        />
      )}
    </div>
  );
}
