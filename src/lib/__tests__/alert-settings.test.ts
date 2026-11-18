/**
 * The dashboard's alert settings, the pure part (lib/alert-settings.ts): a wait typed into the form,
 * whether a test alert can be sent, and which workers it can go to.
 */
import { describe, expect, it } from 'vitest';

import { canTestAlerts, escalationMinutesInput, testableWorkers } from '@/lib/alert-settings';

describe('a wait typed into the form', () => {
  it('a whole number of minutes from 0 (never) to 240', () => {
    expect(escalationMinutesInput(10)).toBe(10);
    expect(escalationMinutesInput('15')).toBe(15);
    expect(escalationMinutesInput(' 0 ')).toBe(0);
    expect(escalationMinutesInput(240)).toBe(240);
  });

  it('anything else is not sent: empty, a fraction, negative, too long, words', () => {
    for (const bad of ['', null, undefined, Number.NaN, 2.5, '2.5', -1, 241, 'ten']) expect(escalationMinutesInput(bad as never)).toBeNull();
  });
});

describe('a test alert from the dashboard', () => {
  it('needs the alerts app (or the older bridge) on the server', () => {
    expect(canTestAlerts({ app_configured: true, alertops_configured: false })).toBe(true);
    expect(canTestAlerts({ app_configured: false, alertops_configured: true })).toBe(true);
    expect(canTestAlerts({ alertops_configured: false })).toBe(false);
    expect(canTestAlerts(null)).toBe(false);
  });

  it('with the app, goes only to workers who have a login for it', () => {
    const workers = [{ name: 'Ravi', user_id: 'u-ravi' }, { name: 'Gita', user_id: null }, { name: 'Old', user_id: undefined }];
    expect(testableWorkers(workers, { app_configured: true, alertops_configured: false }).map((w) => w.name)).toEqual(['Ravi']);
    expect(testableWorkers(workers, { app_configured: false, alertops_configured: true })).toHaveLength(3);
    expect(testableWorkers(workers, undefined)).toHaveLength(3);
  });
});
