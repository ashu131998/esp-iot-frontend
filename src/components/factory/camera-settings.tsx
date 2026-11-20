'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { PICTURE_EVERY, cameraTitle, camerasQueryKey, pictureEveryWord, type Camera } from '@/lib/cameras';
import { useFactoryRefs } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';

/**
 * A camera's settings (the factory's admins): the machine it is at (alerts name it), whether something in front of
 * it raises an alert, how it is mounted, how often it sends a picture. Saved to the camera in one go.
 */
export function CameraSettingsSheet({ factoryId, camera, onClose }: { factoryId: string; camera: Camera; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('Settings · {camera}', { camera: cameraTitle(camera, t) })} onClose={onClose}>
      <CameraSettingsForm factoryId={factoryId} camera={camera} onClose={onClose} />
    </Sheet>
  );
}

export function CameraSettingsForm({ factoryId, camera, onClose }: { factoryId: string; camera: Camera; onClose: () => void }) {
  const { t, tn } = useT();
  const queryClient = useQueryClient();
  const { machines } = useFactoryRefs();
  const [machineId, setMachineId] = useState(camera.machine_id ?? '');
  const [viewAlert, setViewAlert] = useState(camera.view_alert);
  const [flip, setFlip] = useState(camera.settings.flip);
  const [mirror, setMirror] = useState(camera.settings.mirror);
  const [every, setEvery] = useState(camera.settings.pic_every_s);
  const save = useMutation({
    mutationFn: () => api.saveCameraSettings(factoryId, camera.board_id, {
      cam: { flip, mirror, pic_every_s: every, exposure: camera.settings.exposure, gain: camera.settings.gain },
      machine_id: machineId || null,
      view_alert: viewAlert,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: camerasQueryKey(factoryId) });
      onClose();
    },
  });
  const sortedMachines = [...machines].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const everyChoices = PICTURE_EVERY.includes(every as (typeof PICTURE_EVERY)[number]) ? [...PICTURE_EVERY] : [...PICTURE_EVERY, every];

  return (
    <div className="space-y-5 text-sm">
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={viewAlert} onChange={(e) => setViewAlert(e.target.checked)} />
        <span>
          <span className="font-medium">{t('Alert when something is in front of the camera')}</span>
          <span className="block text-xs text-muted">
            {t('A hand on the lens, a cover, anything big right in front of it: the factory\'s admins get it in the app and by email, with the picture.')}
          </span>
        </span>
      </label>
      <Field label={t('Machine it is at')}>
        <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">{t('No machine')}</option>
          {sortedMachines.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>{m.name}</option>
          ))}
        </Select>
      </Field>
      <Field label={t('A picture')}>
        <Select value={String(every)} onChange={(e) => setEvery(Number(e.target.value))}>
          {everyChoices.map((s) => <option key={s} value={String(s)}>{pictureEveryWord(s, t, tn)}</option>)}
        </Select>
      </Field>
      <div className="space-y-2">
        <p className="font-medium">{t('How it is mounted')}</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
          {t('Upside down')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          {t('Mirrored')}
        </label>
      </div>
      {save.isError && <p className="text-red-600">{(save.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? t('Sending…') : t('Save')}</Button>
        <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
      </div>
    </div>
  );
}
