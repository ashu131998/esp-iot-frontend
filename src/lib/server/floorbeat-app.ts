import 'server-only';

import { headers } from 'next/headers';

import { isDashboardAppHost } from '@/lib/hosts';

/**
 * Whether the page is drawn for the FloorBeat app's address (dashboard.floorbeat.in), where the alerts' and the
 * stock's screens are parts of that one app (/inbox, /ims), not apps of their own (alerts.floorbeat.in,
 * ims.floorbeat.in).
 */
export async function inFloorBeatApp(): Promise<boolean> {
  return isDashboardAppHost((await headers()).get('host'), process.env.FACTORY_HOST_SUFFIX, process.env.DASHBOARD_APP_HOST);
}
