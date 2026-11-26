'use client';

import { CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useT } from '@/lib/i18n/context';

type CameraState = 'starting' | 'live' | 'blocked' | 'none' | 'failed';

interface Detector {
  detect(video: HTMLVideoElement): Promise<string | null>;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** The longest side of the frame the iPhone reader looks at: enough for a label held 30–60 cm away. */
const READ_SIDE = 720;

/**
 * The phone's own QR reader where it has one (Android's Chrome), else jsQR, loaded only now (iPhone
 * Safari has none): it reads a still of the camera drawn small onto a canvas.
 */
async function makeDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) ?? [];
      if (formats.includes('qr_code')) {
        const native = new Native({ formats: ['qr_code'] });
        return { detect: async (video) => (await native.detect(video))[0]?.rawValue ?? null };
      }
    } catch {
      // fall through to jsQR
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    detect: async (video) => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!ctx || !w || !h) return null;
      const scale = Math.min(1, READ_SIDE / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    },
  };
}

/** How long the same QR is not reported again (it is still in front of the camera). */
const SAME_CODE_MS = 2500;
const LOOK_EVERY_MS = 150;

/**
 * The back camera's live view, reading QR codes: each one read is given to `onRead` (the screen
 * decides what it is). Stops the camera when it leaves the screen or the app is put away, and starts
 * it again on return. Without a camera, or with it blocked, it says so: the code can always be typed.
 */
export function QrScanner({ onRead }: { onRead: (text: string) => void }) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(true);
  const read = useRef(onRead);
  useEffect(() => { read.current = onRead; }, [onRead]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = video.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = { text: '', at: 0 };

    (async () => {
      setState('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('none');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        if (stopped) return;
        const name = (error as { name?: string } | null)?.name;
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'failed');
        return;
      }
      if (stopped || !el) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      el.srcObject = stream;
      try {
        await el.play();
      } catch {
        // iPhone may refuse play() until the view is tapped; the frames still come with autoPlay + muted
      }
      let detector: Detector;
      try {
        detector = await makeDetector();
      } catch {
        if (!stopped) setState('failed');
        return;
      }
      if (stopped) return;
      setState('live');
      const look = async () => {
        if (stopped) return;
        try {
          const text = el.readyState >= 2 ? await detector.detect(el) : null;
          const now = Date.now();
          if (text && !stopped && (text !== last.text || now - last.at > SAME_CODE_MS)) {
            last = { text, at: now };
            navigator.vibrate?.(60);
            read.current(text);
          } else if (text) {
            last.at = now;
          }
        } catch {
          // a frame that could not be read: the next one is tried
        }
        if (!stopped) timer = setTimeout(() => void look(), LOOK_EVERY_MS);
      };
      void look();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (el) el.srcObject = null;
    };
  }, [visible, attempt]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-900">
      <video ref={video} autoPlay muted playsInline className="h-full w-full object-cover" aria-label={t('Camera')} />
      {state === 'live' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <div className="h-1/2 w-1/2 min-w-40 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
        </div>
      )}
      {state !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          {state === 'starting' ? (
            <p className="text-base">{t('Starting the camera…')}</p>
          ) : (
            <>
              <CameraOff className="h-8 w-8" aria-hidden />
              <p className="text-base">
                {state === 'blocked'
                  ? t('The camera is blocked for this app. Allow it in the phone\'s settings, or type the code below.')
                  : state === 'none'
                    ? t('This phone has no camera the app can use. Type the code below.')
                    : t('The camera did not start. Try again, or type the code below.')}
              </p>
              {state !== 'none' && (
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-11 rounded-xl bg-white px-4 font-medium text-slate-900">
                  {t('Try again')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
