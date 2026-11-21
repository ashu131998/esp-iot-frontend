/**
 * The alerts app's page head (app/alerts-app/layout.tsx generateMetadata): the manifest that makes
 * the site installable goes to an iPhone or an iPad only (the user: "only on iphone"). Android has
 * the APK, so Chrome there cannot install the site as an app; nor can a computer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ userAgent: '' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': request.userAgent }) }));

const { generateMetadata } = await import('@/app/alerts-app/layout');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

afterEach(() => { request.userAgent = ''; });

describe('the app\'s page head', () => {
  it('an iPhone: the manifest, with the Home Screen settings', async () => {
    request.userAgent = IPHONE;
    const meta = await generateMetadata();
    expect(meta.manifest).toBe('/alerts-app.webmanifest');
    expect(meta.appleWebApp).toMatchObject({ capable: true, title: 'FloorBeat Alerts' });
    expect(meta.title).toBe('FloorBeat Alerts');
  });

  it('Android (inside the APK too) and a computer: no manifest, the rest the same', async () => {
    for (const ua of [ANDROID, WINDOWS, '']) {
      request.userAgent = ua;
      const meta = await generateMetadata();
      expect(meta.manifest, ua).toBeUndefined();
      expect(meta.title).toBe('FloorBeat Alerts');
    }
  });
});
