'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { LOCALES, LOCALE_NAMES, rememberLocale, type Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

/** The question in each language: it is asked before any language is known. */
const QUESTION: Record<Locale, string> = {
  en: 'Choose your language',
  hi: 'अपनी भाषा चुनें',
  gu: 'તમારી ભાષા પસંદ કરો',
};

/**
 * The app's first question on a phone (the user, 2026-11-21: "in the starting of the app, ask
 * language"): English, हिन्दी or ગુજરાતી, before sign-in. The choice goes in the language cookie
 * (lib/i18n/locale.ts) and the page comes back in that language; Settings can change it later.
 */
export function LanguageChoice({ onChosen }: { onChosen: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Locale | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    setPicked(locale);
    rememberLocale(locale);
    // The app appears once the page is back from the server in the chosen language.
    startTransition(() => {
      router.refresh();
      onChosen();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark className="h-14 w-14" />
        <div className="space-y-1">
          {LOCALES.map((l) => (
            <p key={l} lang={l} className={l === 'en' ? 'text-xl font-semibold text-foreground' : 'text-base text-muted'}>
              {QUESTION[l]}
            </p>
          ))}
        </div>
      </div>
      <div role="group" aria-label={QUESTION.en} className="flex flex-col gap-3">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => choose(l)}
            disabled={pending}
            className={cn(
              'h-14 rounded-2xl bg-white text-lg font-semibold text-foreground shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60',
              picked === l && 'ring-2 ring-primary',
            )}
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
