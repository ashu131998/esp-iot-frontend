'use client';

import { Camera, ImagePlus, Loader2, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';

import { useT } from '@/lib/i18n/context';
import { photoTime, shrinkPhoto, type TakenAtSource } from '@/lib/ims/photo';
import { cn } from '@/lib/utils';

/** A photo chosen for a field, made small already (so Add stock is instant and a bad file shows at once). */
export interface ReadyPhoto {
  full: Blob;
  thumb: Blob;
  source: 'camera' | 'library';
  takenAt: Date;
  takenAtSource: TakenAtSource;
  /** The small one as a data: address, to show it (no object URL to let go of). */
  preview: string;
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('The photo could not be read'));
    reader.readAsDataURL(blob);
  });
}

/** Makes a picked file ready: its time read first (making it small drops the photo's own date), then shrunk. */
export async function readyPhoto(file: File, source: 'camera' | 'library'): Promise<ReadyPhoto> {
  const time = await photoTime(file, source);
  const { full, thumb } = await shrinkPhoto(file);
  return { full, thumb, source: time.source, takenAt: time.takenAt, takenAtSource: time.takenAtSource, preview: await dataUrl(thumb) };
}

const pickButton = 'flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl text-base font-medium text-primary ring-1 ring-slate-300 active:bg-slate-50';

/**
 * A photo field on Add stock: "Take photo" opens the camera, "Choose from phone" the gallery (and files).
 * The chosen one shows small, with Remove. `error`: the field's problem to show (required and missing).
 */
export function FieldPhoto({ id, label, required, value, onChange, error, allowLibrary = true }: {
  id: string;
  label: string;
  required: boolean;
  /** false: the field's photo must be taken now (the library button is not shown). */
  allowLibrary?: boolean;
  value: ReadyPhoto | null;
  onChange: (photo: ReadyPhoto | null) => void;
  error: string | null;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const pick = (source: 'camera' | 'library') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // the same photo picked again still counts
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await readyPhoto(file, source));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p id={`${id}-label`} className="block text-sm text-muted">
        {label}{required ? ' *' : ''}
      </p>
      {value ? (
        <div className="mt-1 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a picture on the phone, not a page asset */}
          <img src={value.preview} alt={label} className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            {value.source === 'camera' ? t('Photo taken') : t('Photo from the phone')}
          </p>
          <button type="button" onClick={() => onChange(null)} className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-medium text-primary ring-1 ring-slate-300">
            <X className="h-4 w-4" aria-hidden />{t('Remove')}
          </button>
        </div>
      ) : busy ? (
        <p className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl text-sm text-muted ring-1 ring-slate-200" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('Getting the photo ready…')}
        </p>
      ) : (
        <div className={cn('mt-1 flex gap-2', error && 'rounded-xl ring-2 ring-red-400')} role="group" aria-labelledby={`${id}-label`}>
          <label className={pickButton}>
            <Camera className="h-5 w-5" aria-hidden />{t('Take photo')}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void pick('camera')(e)} />
          </label>
          {allowLibrary && (
            <label className={pickButton}>
              <ImagePlus className="h-5 w-5" aria-hidden />{t('Choose from phone')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick('library')(e)} />
            </label>
          )}
        </div>
      )}
      {failed && (
        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-red-700">
          <TriangleAlert className="h-4 w-4" aria-hidden />{t('This photo could not be read. Take it again or choose another.')}
        </p>
      )}
      {error && <p className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
