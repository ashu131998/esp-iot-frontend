'use client';

import { Boxes, PackagePlus } from 'lucide-react';

import { useImsHref } from '@/components/ims-app/ims-links';
import { AppLink } from '@/components/ui/app-link';
import { useT } from '@/lib/i18n/context';

const big = 'flex h-24 items-center gap-4 rounded-2xl bg-white px-5 text-lg font-semibold text-foreground shadow-sm ring-1 ring-gray-100 active:bg-slate-50';

/** IMS's home: one big button per job on the floor. Move, Take out and Count join as they are built. */
export function ImsHome() {
  const { t } = useT();
  const imsLink = useImsHref();
  return (
    <div className="grid gap-3">
      <AppLink href={imsLink('/add')} className={big}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><PackagePlus className="h-7 w-7" /></span>
        {t('Add item')}
      </AppLink>
      <AppLink href={imsLink('/stock')} className={big}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Boxes className="h-7 w-7" /></span>
        {t('Available stock')}
      </AppLink>
    </div>
  );
}
