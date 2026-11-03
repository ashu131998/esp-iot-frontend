/**
 * The light sidebar every shell shares (factory, staff console, platform): a white panel with a
 * hairline edge, quiet grey items, the current page as a soft pill in the primary colour (a
 * factory's own brand colour on its pages), small uppercase group headings.
 */
import { cn } from '@/lib/utils';

export const SIDEBAR_PANEL = 'border-r border-gray-100 bg-white text-foreground';

export function sidebarItemClass(active: boolean): string {
  return cn(
    'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
    active ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-50 hover:text-foreground',
  );
}

export function sidebarIconClass(active: boolean): string {
  return cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600');
}

export const SIDEBAR_HEADING = 'px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400';
