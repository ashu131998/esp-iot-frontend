import { Suspense } from 'react';

import { FactoryNotFound } from '@/components/auth/factory-not-found';
import { LoginForm } from '@/components/auth/login-form';
import { brandStyle, logoUrl } from '@/lib/branding';
import { getT } from '@/lib/i18n/server';
import { lookupFactory } from '@/lib/server/factory-lookup';

export const dynamic = 'force-dynamic';

export default async function FactoryLoginPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const [factory, { t }] = await Promise.all([lookupFactory(factoryId), getT()]);
  if (factory.status === 'missing') return <FactoryNotFound factoryId={factoryId} />;

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
