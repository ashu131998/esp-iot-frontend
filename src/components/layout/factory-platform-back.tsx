'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { staffHomePath } from '@/lib/internal-auth';
import { cn } from '@/lib/utils';

/** Mobile header link back to staff hub or this factory’s overview. */
export function FactoryPlatformBack({ factoryId, className }: { factoryId: string; className?: string }) {
  const { isInternalStaff } = useAuth();
  const href = isInternalStaff ? staffHomePath() : `/factories/${factoryId}`;
  const label = isInternalStaff ? 'Back to Internal' : 'Factory home';

  return (
    <Link href={href} className={cn('flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground', className)}>
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
