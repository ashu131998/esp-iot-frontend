'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Where adding and editing happen: a sheet from the bottom of the screen on phones, a
 * centred window from sm up, over the page either way. Closes on its X, a tap outside it,
 * or Escape. Rendered into the factory shell ([data-sheet-root]) so the factory's brand
 * colours apply, else into the body.
 */
export function Sheet({
  title,
  onClose,
  size = 'md',
  children,
}: {
  title: string;
  /** What the form's Cancel does: closing the sheet does the same. */
  onClose: () => void;
  /** lg for a wide editor (a node's sensor channels). */
  size?: 'md' | 'lg';
  children: React.ReactNode;
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <p className="min-w-0 truncate text-sm font-semibold sm:text-base">{title}</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.querySelector('[data-sheet-root]') ?? document.body,
  );
}
