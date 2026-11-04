import Link from 'next/link';

import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">{t('404 — Not Found')}</h1>
      <p className="text-muted">{t('The page or factory you requested does not exist.')}</p>
      <Link href="/overview" className="text-primary hover:underline">
        {t('Back to overview')}
      </Link>
    </div>
  );
}
