import { Card, CardHeader } from '@/components/ui/card';
import { getT } from '@/lib/i18n/server';

/** The sign-in pages when the URL names a factory that does not exist. */
export async function FactoryNotFound({ factoryId }: { factoryId: string }) {
  const { t } = await getT();
  const marketingUrl = process.env.MARKETING_URL?.trim();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <CardHeader
          title={t('Factory not found')}
          description={t('There is no factory with the ID “{id}”. Check the ID in your welcome email.', { id: factoryId })}
        />
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {marketingUrl && (
            <a className="text-primary hover:underline" href={`${marketingUrl}/login`}>
              {t('Try another factory ID')}
            </a>
          )}
          <a
            className="text-primary hover:underline"
            href="mailto:support@floorbeat.in?subject=FloorBeat%20login%20help"
          >
            {t('Contact support')}
          </a>
        </div>
      </Card>
    </div>
  );
}
