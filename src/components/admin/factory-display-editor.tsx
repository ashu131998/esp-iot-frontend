'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { FACTORY_PAGES, OFF_BAR_PAGES, factoryTabs, resolveDisplay, tabsFor, type DisplayPage } from '@/lib/display';
import { BOTTOM_BAR_FULL, BOTTOM_BAR_SIZE, barPages, barPatch, bottomBarTabs, moreTabs, shortLabel } from '@/lib/mobile-nav';
import type { Factory } from '@/lib/types';
import { cn } from '@/lib/utils';

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/**
 * Staff screen: which pages, and which parts of each page, one factory shows.
 * A page that is off leaves the factory's menu and its data is refused; a part
 * that is off is not shown or loaded. Each switch saves on its own.
 */
export function FactoryDisplayEditor({
  factory,
  pages,
}: {
  factory: Factory;
  pages: DisplayPage[];
}) {
  const qc = useQueryClient();
  const factoryId = factory.factory_id;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server's own answer (it knows what the factory has: a camera turns the Cameras page on); else the catalog's.
  const display = factory.display ?? resolveDisplay(pages, factory.features);

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      api.adminUpdateFactoryFeatures(factoryId, { [key]: value }),
    onMutate: ({ key }) => {
      setError(null);
      setPending(key);
    },
    onSuccess: (data) => {
      // Apply the authoritative switches from the PATCH response straight into
      // the cache. Don't refetch here — listFactories reads the read replica,
      // which lags the write and would flip the switch back.
      qc.setQueryData<{ factories: Factory[] }>(['admin-factories'], (prev) =>
        prev
          ? {
              ...prev,
              factories: prev.factories.map((f) =>
                f.factory_id === data.factory_id
                  ? { ...f, features: data.features, display: data.display ?? resolveDisplay(pages, data.features) }
                  : f,
              ),
            }
          : prev,
      );
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setPending(null),
  });

  const toggle = (key: string, value: boolean) => mutation.mutate({ key, value });

  return (
    <Card className="p-6">
      <CardHeader
        title="Pages & sections"
        description="Choose which pages, and which parts of each page, this factory sees. A page that is off leaves the factory's menu and its data is refused. Only our staff can change this."
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-2 divide-y">
        {pages.map((page) => {
          const pageOn = display[page.key] !== false;
          return (
            <li key={page.key} className="py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-foreground">{page.label}</span>
                {page.fixed ? (
                  <span className="text-xs text-muted">Always on</span>
                ) : (
                  <Switch
                    label={`${page.label} page`}
                    checked={pageOn}
                    disabled={pending !== null}
                    onChange={(value) => toggle(page.key, value)}
                  />
                )}
              </div>
              {page.sections.length > 0 && (
                <ul className="mt-2 space-y-2 border-l pl-4">
                  {page.sections.map((section) => (
                    <li key={section.key} className="flex items-start justify-between gap-4 text-sm">
                      <div className={cn('min-w-0 flex-1', !pageOn && 'opacity-60')}>
                        <div className="text-foreground">{section.label}</div>
                        {section.description ? (
                          <p className="mt-0.5 text-xs leading-snug text-muted">{section.description}</p>
                        ) : null}
                      </div>
                      <Switch
                        label={`${page.label}: ${section.label}`}
                        checked={display[section.key] !== false}
                        disabled={pending !== null || !pageOn}
                        onChange={(value) => toggle(section.key, value)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * Staff screen: which of the factory's pages sit on the phone's bottom bar (the dashboard on a phone,
 * and the FloorBeat app). Up to four show beside "More", which holds the factory's other pages; five
 * when they are all of its pages. A change saves every page's place at once, so the bar is exactly
 * what this screen shows: the bar of the factory's admins (our staff's own Alerts and Stock tabs are not
 * theirs, and Alert settings never sits on the bar).
 */
export function FactoryBarEditor({ factory, pages }: { factory: Factory; pages: DisplayPage[] }) {
  const qc = useQueryClient();
  const factoryId = factory.factory_id;
  const [error, setError] = useState<string | null>(null);
  const display = factory.display ?? resolveDisplay(pages, factory.features);
  // the pages this factory's admins have, in menu order; the ones that can sit on the bar listed below
  const seen = tabsFor(factoryTabs(factoryId, display), { canWrite: true, staff: false });
  const menu = seen.filter((t) => !OFF_BAR_PAGES.has(t.slug));
  const chosen = new Set(barPages(seen, display).map((t) => t.slug));
  const bar = bottomBarTabs(seen, display);
  const more = moreTabs(seen, display);
  const waiting = [...chosen].filter((slug) => !bar.some((t) => t.slug === slug));

  const mutation = useMutation({
    mutationFn: (change: { slug: string; on: boolean }) =>
      api.adminUpdateFactoryFeatures(factoryId, barPatch(FACTORY_PAGES, seen, display, change)),
    onMutate: () => setError(null),
    onSuccess: (data) => {
      // The server's own answer straight into the cache (the list is read from the replica, which lags).
      qc.setQueryData<{ factories: Factory[] }>(['admin-factories'], (prev) =>
        prev
          ? {
              ...prev,
              factories: prev.factories.map((f) =>
                f.factory_id === data.factory_id
                  ? { ...f, features: data.features, display: data.display ?? resolveDisplay(pages, data.features) }
                  : f,
              ),
            }
          : prev,
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Card className="p-6">
      <CardHeader
        title="Phone bottom bar"
        description={`Which pages sit on the bottom bar of the dashboard on a phone and of the FloorBeat app. Up to ${BOTTOM_BAR_SIZE} show beside "More", which holds the factory's other pages (${BOTTOM_BAR_FULL} when they are all of its pages). A page that is switched off above is not listed.`}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-muted">On phones now: </span>
        <span className="font-medium text-foreground">
          {[...bar.map((t) => shortLabel(t)), ...(more.length > 0 ? [`More (${more.length})`] : [])].join(' · ') || 'More only'}
        </span>
      </p>
      {waiting.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Only {BOTTOM_BAR_SIZE} fit beside &quot;More&quot;: {waiting.map((slug) => menu.find((t) => t.slug === slug)?.label ?? slug).join(', ')} {waiting.length === 1 ? 'is' : 'are'} behind &quot;More&quot; until another page leaves the bar.
        </p>
      )}
      <ul className="mt-3 divide-y">
        {menu.map((tab) => (
          <li key={tab.slug} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm text-foreground">{tab.label}</span>
            <Switch
              label={`${tab.label} on the bottom bar`}
              checked={chosen.has(tab.slug)}
              disabled={mutation.isPending}
              onChange={(on) => mutation.mutate({ slug: tab.slug, on })}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
