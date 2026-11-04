import { redirect } from 'next/navigation';

import { FactoryNotFound } from '@/components/auth/factory-not-found';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { realFactoryPagePath } from '@/lib/auth-redirect';
import { brandStyle, logoUrl } from '@/lib/branding';
import { getT } from '@/lib/i18n/server';
import { lookupFactory } from '@/lib/server/factory-lookup';

export const dynamic = 'force-dynamic';

/** "Forgot password?" for a factory's accounts: emails a 30-minute link to set a new one. */
export default async function FactoryForgotPasswordPage({
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
    redirect(realFactoryPagePath('forgot-password', factory.factoryId, factoryId, await searchParams));
  }

  const name = factory.status === 'found' ? factory.name : factoryId.replace(/-/g, ' ');
  const branding = factory.status === 'found' ? factory.branding : null;
  return (
    <ForgotPasswordForm
      title={t('Forgot your password?')}
      subtitle={t('We will email you a link to set a new one for {name}.', { name })}
      factoryId={factoryId}
      logoSrc={logoUrl(factoryId, branding)}
      brand={brandStyle(branding)}
    />
  );
}
