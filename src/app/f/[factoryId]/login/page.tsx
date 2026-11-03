import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { FactoryNotFound } from '@/components/auth/factory-not-found';
import { LoginForm } from '@/components/auth/login-form';
import { realFactoryPagePath } from '@/lib/auth-redirect';
import { brandStyle, logoUrl } from '@/lib/branding';
import { getT } from '@/lib/i18n/server';
import { lookupFactory } from '@/lib/server/factory-lookup';

export const dynamic = 'force-dynamic';

export default async function FactoryLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ factoryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { factoryId } = await params;
  const [factory, { t }] = await Promise.all([lookupFactory(factoryId), getT()]);
  if (factory.status === 'missing') return <FactoryNotFound factoryId={factoryId} />;
  // An ID typed in other letters ("Factory-01") finds the factory: move to its real address.
  if (factory.status === 'found' && factory.factoryId !== factoryId) {
    redirect(realFactoryPagePath('login', factory.factoryId, factoryId, await searchParams));
  }

  const name = factory.status === 'found' ? factory.name : factoryId.replace(/-/g, ' ');
  const branding = factory.status === 'found' ? factory.branding : null;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">{t('Loading…')}</div>
      }
    >
      <LoginForm
        title={t('Factory Sign In')}
        subtitle={t('Sign in to {name}', { name })}
        factoryId={factoryId}
        logoSrc={logoUrl(factoryId, branding)}
        brand={brandStyle(branding)}
      />
    </Suspense>
  );
}
