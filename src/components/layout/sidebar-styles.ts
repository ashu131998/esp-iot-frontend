/**
 * The dark sidebar every shell shares (factory, staff console, platform): near-black with a faint
 * glow of the factory's colour (`.sidebar-surface`, globals.css), quiet grey items with icons, the
 * current page as a soft light pill with a marker and icon in the factory's colour, small group
 * headings, soft inset cards.
 */
import { cn } from '@/lib/utils';

export const SIDEBAR_PANEL = 'sidebar-surface border-r border-white/[0.06]';

export function sidebarItemClass(active: boolean): string {
  return cn(
    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
    active
      ? 'bg-linear-to-r from-white/[0.10] to-white/[0.04] text-white before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[color:var(--sidebar-accent)]'
      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
  );
}

export function sidebarIconClass(active: boolean): string {
  return cn(
    'h-4 w-4 shrink-0 transition-colors',
    active ? 'text-[color:var(--sidebar-accent)]' : 'text-slate-500 group-hover:text-slate-300',
  );
}

export const SIDEBAR_HEADING = 'px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500';

/** A soft inset card on the sidebar (the shifts). */
export const SIDEBAR_CARD = 'rounded-xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]';
