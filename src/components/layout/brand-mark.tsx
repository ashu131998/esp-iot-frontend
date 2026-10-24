import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#ff5a1f" />
      <path
        d="M4 17h6l3-7 5 13 3-6h7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
