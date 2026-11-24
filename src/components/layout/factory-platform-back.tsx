'use client';

import { ChevronLeft } from 'lucide-react';

import { AppLink } from '@/components/ui/app-link';
import { useAuth } from '@/lib/auth-context';
import { staffHomePath } from '@/lib/internal-auth';
import { cn } from '@/lib/utils';
import { useFactoryHref } from '@/lib/factory-links-context';

/** Mobile header link back to staff hub or this factory’s overview. */
export function FactoryPlatformBack({ factoryId, className }: { factoryId: string; className?: string }) {
  const link = useFactoryHref();
  const { isInternalStaff } = useAuth();
  const href = isInternalStaff ? staffHomePath() : link(`/factories/${factoryId}`);
  const label = isInternalStaff ? 'Back to Internal' : 'Factory home';

  return (
    <AppLink href={href} className={cn('flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground', className)}>
      <ChevronLeft className="h-4 w-4" />
      {label}
    </AppLink>
  );
}
