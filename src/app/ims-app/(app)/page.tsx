import { Boxes, ScanLine } from 'lucide-react';

import { AppLink } from '@/components/ui/app-link';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** IMS's home: one big button per job on the floor. Move, Take out and Count join as they are built. */
export default async function ImsHomePage() {
  const { t } = await getT();
  return (
    <div className="grid gap-3">
      <AppLink
        href="/scan"
        className="flex h-24 items-center gap-4 rounded-2xl bg-white px-5 text-lg font-semibold text-foreground shadow-sm ring-1 ring-gray-100 active:bg-slate-50"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ScanLine className="h-7 w-7" /></span>
        {t('Stock in')}
      </AppLink>
      <AppLink
        href="/stock"
        className="flex h-24 items-center gap-4 rounded-2xl bg-white px-5 text-lg font-semibold text-foreground shadow-sm ring-1 ring-gray-100 active:bg-slate-50"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Boxes className="h-7 w-7" /></span>
        {t('Available stock')}
      </AppLink>
    </div>
  );
}
