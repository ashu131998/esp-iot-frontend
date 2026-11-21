import { InstallGuide } from '@/components/alerts-app/install-guide';

export const dynamic = 'force-dynamic';

/**
 * Linked from floorbeat.in/app. Outside the app the layout's gate shows the steps for this phone
 * instead (components/alerts-app/app-gate.tsx); inside it, this page says it is installed.
 */
export default function InstallPage() {
  return <InstallGuide access="open" />;
}
