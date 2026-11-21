import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The app page (public/app.html, floorbeat.in/app): the Android download, the iPhone steps, the
 * app's address, and the help for alerts that do not arrive.
 */
const html = readFileSync(join(__dirname, '..', 'public', 'app.html'), 'utf8');

describe('floorbeat.in/app', () => {
  it('offers the Android APK and the iPhone steps', () => {
    expect(html).toContain('href="/downloads/floorbeat-alerts.apk"');
    expect(html).toContain('Add to Home Screen');
    expect(html).toContain('https://alerts.floorbeat.in/install');
    expect(html).toContain('href="https://alerts.floorbeat.in/"');   // the app's address, never a "login" page (an iPhone not yet installed)
    expect(html).not.toContain('alerts.floorbeat.in/login');
  });

  it('sends Android to the APK only: the app does not open in a browser tab', () => {
    expect(html).not.toContain('in Chrome and choose');
  });

  it('says what the app does and where to get help', () => {
    for (const must of ['Machine stopped', 'Shift reminders', 'Hindi and Gujarati', 'Send a test', 'support@floorbeat.in', 'Team page']) {
      expect(html, must).toContain(must);
    }
    expect(html).toContain('<link rel="canonical" href="https://floorbeat.in/app">');
  });
});
