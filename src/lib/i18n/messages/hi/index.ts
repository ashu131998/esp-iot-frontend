import type { Messages } from '../../translate';

import { alerts } from './alerts';
import { auth } from './auth';
import { calibration } from './calibration';
import { common } from './common';
import { dates } from './dates';
import { factory_admin } from './factory-admin';
import { factory_metrics } from './factory-metrics';
import { nav } from './nav';
import { pages } from './pages';
import { results } from './results';
import { maintenance } from './maintenance';
import { sensors } from './sensors';

/** Every Hindi message, by its English text. Loaded on the server only (lib/i18n/server.ts). */
export const HI_NAMESPACES: Record<string, Messages> = {
  common,
  nav,
  dates,
  factory_metrics,
  factory_admin,
  alerts,
  sensors,
  maintenance,
  auth,
  calibration,
  pages,
  results,
};

export const hi: Messages = Object.assign({}, ...Object.values(HI_NAMESPACES));
