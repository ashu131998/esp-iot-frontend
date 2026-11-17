import { InstallGuide } from '@/components/alerts-app/install-guide';

export const dynamic = 'force-dynamic';

/** Public: linked from the download page and from the app's settings. */
export default function InstallPage() {
  return <InstallGuide />;
}
