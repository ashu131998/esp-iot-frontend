import { cn } from '@/lib/utils';

/**
 * The FloorBeat app's icon (the dashboard on a phone): the brand's mark on the dashboard's dark blue,
 * its pulse in the brand's orange, so it is told apart from FloorBeat Alerts (white on orange) on a
 * phone's Home Screen. public/dashboard-icon-*.png are this drawing.
 */
export function DashboardAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="64" height="64" rx="16" fill="#0f172a" />
      <path d="M25.84 15.09A18 18 0 1 0 38.16 15.09" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M7 32h18l3.5-6 7 12 3.5-6h18" fill="none" stroke="#f5561e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
