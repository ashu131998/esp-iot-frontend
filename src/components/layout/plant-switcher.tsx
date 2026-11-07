'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

const TONES = {
  dark: {
    name: 'text-white',
    sub: 'text-slate-400',
    button: 'hover:bg-white/[0.06]',
    icon: 'text-slate-400',
    panel: 'bg-slate-900 ring-1 ring-white/10 shadow-2xl',
    heading: 'text-slate-500',
    item: 'text-slate-200 hover:bg-white/[0.07]',
    current: 'text-white',
    error: 'text-red-300',
  },
  light: {
    name: 'text-foreground',
    sub: 'text-muted',
    button: 'hover:bg-slate-100',
    icon: 'text-muted',
    panel: 'bg-white ring-1 ring-black/5 shadow-lg',
    heading: 'text-muted',
    item: 'text-foreground hover:bg-slate-50',
    current: 'text-primary',
    error: 'text-red-600',
  },
};

/**
 * The factory's name in the sidebar and the phone header. A company's admin has one account for
 * every factory of the company: for them it opens the others. Choosing one gets a one-time pass
 * and goes to that factory's own address, which signs them in there (same device, no password).
 */
export function PlantSwitcher({
  factoryId, factoryName, subtitle, tone,
}: {
  factoryId: string;
  factoryName: string;
  subtitle?: string | null;
  tone: keyof typeof TONES;
}) {
  const { user } = useAuth();
  const { t } = useT();
  const s = TONES[tone];
  const companyAdmin = Boolean(user?.company_id);
  const plantsQuery = useQuery({
    queryKey: ['auth-plants'],
    queryFn: ({ signal }) => api.authPlants({ signal }),
    enabled: companyAdmin,
    staleTime: 5 * 60_000,
  });
  const plants = plantsQuery.data?.plants ?? [];
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = (
    <span className="block min-w-0 text-left">
      <span className={cn('block truncate text-sm font-semibold leading-tight', s.name)}>{factoryName}</span>
      {subtitle && <span className={cn('mt-0.5 block truncate text-xs leading-tight', s.sub)}>{subtitle}</span>}
    </span>
  );
  if (!companyAdmin || plants.length < 2) return <div className="min-w-0 flex-1">{name}</div>;

  const go = async (id: string) => {
    if (id === factoryId) {
      setOpen(false);
      return;
    }
    setGoing(id);
    setError(null);
    try {
      const { url } = await api.authSwitch(id);
      window.location.assign(url);
    } catch {
      setGoing(null);
      setError(t('Could not open that factory'));
    }
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('Switch factory')}
        onClick={() => setOpen((o) => !o)}
        className={cn('-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1', s.button)}
      >
        {name}
        <ChevronsUpDown className={cn('ml-auto h-4 w-4 shrink-0', s.icon)} aria-hidden="true" />
      </button>
      {open && (
        <div className={cn('absolute left-0 right-0 top-full z-50 mt-2 min-w-[14rem] rounded-xl p-1', s.panel)}>
          <p className={cn('px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em]', s.heading)}>{t('Your factories')}</p>
          <div role="listbox" aria-label={t('Your factories')}>
            {plants.map((p) => {
              const here = p.factory_id === factoryId;
              return (
                <button
                  key={p.factory_id}
                  type="button"
                  role="option"
                  aria-selected={here}
                  disabled={going !== null}
                  onClick={() => go(p.factory_id)}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-60', s.item, here && cn('font-semibold', s.current))}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {here && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  {going === p.factory_id && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {error && <p className={cn('px-3 py-2 text-xs', s.error)} role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
