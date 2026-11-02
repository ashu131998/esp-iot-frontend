'use client';

import { Card, CardHeader } from '@/components/ui/card';
import { useT } from '@/lib/i18n/context';

export default function LinesLoading() {
  const { t } = useT();
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader title={t('Production Lines')} description={t('Loading lines…')} />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </Card>
    </div>
  );
}
