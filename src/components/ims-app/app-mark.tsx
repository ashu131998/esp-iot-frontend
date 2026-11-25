import { cn } from '@/lib/utils';

/**
 * FloorBeat IMS's icon: boxes stacked on a pallet, on a deep teal, with the brand's orange pulse as
 * the pallet's deck, so it is told apart from FloorBeat (dark blue) and FloorBeat Alerts (orange) on a
 * phone's Home Screen. public/ims-icon-*.png are this drawing.
 */
export function ImsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="64" height="64" rx="16" fill="#0f5257" />
      <rect x="15" y="27" width="15" height="13" rx="2" fill="#fff" />
      <rect x="34" y="27" width="15" height="13" rx="2" fill="#fff" />
      <rect x="24.5" y="12" width="15" height="13" rx="2" fill="#fff" />
      <path d="M10 45h44" stroke="#f5561e" strokeWidth="4" strokeLinecap="round" />
      <path d="M15 45v6M32 45v6M49 45v6" stroke="#f5561e" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
