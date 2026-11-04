'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { useLocale, useT } from '@/lib/i18n/context';
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, rememberLocale, type Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

/**
 * English | हिन्दी | ગુજરાતી. Stores the choice in the language cookie and re-renders the page from
 * the server in the new language (router.refresh: the page keeps its place and state, nothing
 * reloads). `tone` dark sits on the sidebar, light on white.
 */
export function LanguageToggle({
  tone = 'light',
  compact = false,
  fill = false,
  className,
}: {
  tone?: 'light' | 'dark';
  /** Two-letter labels for narrow places. */
  compact?: boolean;
  /** Take the full width, the languages sharing it equally (the sidebar footer). */
  fill?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    rememberLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t('Language')}
      className={cn(
        fill ? 'flex w-full' : 'inline-flex',
        'rounded-lg p-0.5 text-xs font-medium',
        tone === 'dark' ? 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]' : 'bg-slate-100',
        pending && 'opacity-60',
        className,
      )}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            onClick={() => choose(l)}
            className={cn(
              'rounded-md py-1 transition-colors',
              fill ? 'flex-1 px-1' : 'px-2.5',
              tone === 'dark'
                ? active ? 'bg-white/[0.12] text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'
                : active ? 'bg-white text-foreground shadow-sm ring-1 ring-gray-200' : 'text-muted hover:text-foreground',
            )}
          >
            {compact ? LOCALE_SHORT[l] : LOCALE_NAMES[l]}
          </button>
        );
      })}
    </div>
  );
}
