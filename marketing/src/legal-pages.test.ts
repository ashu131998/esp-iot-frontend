import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The privacy policy and the terms (public/privacy.html, public/terms.html): linked from every
 * page, holding what the law asks of them, and in step with the product: every cookie the
 * dashboard sets is listed, and nothing waits to be filled in before they go live.
 */
const PUBLIC = join(__dirname, '..', 'public');
const APP_SRC = join(__dirname, '..', '..', 'src');
const page = (name: string) => readFileSync(join(PUBLIC, name), 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe('the privacy policy and the terms', () => {
  it('every page links to both', () => {
    const pages = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
    expect(pages).toEqual(expect.arrayContaining(['index.html', 'login.html', 'privacy.html', 'terms.html']));
    for (const name of pages) {
      expect(page(name), name).toContain('href="/privacy"');
      expect(page(name), name).toContain('href="/terms"');
    }
  });

  it('the policy holds what the DPDP Act and the IT rules ask of it', () => {
    const privacy = text(page('privacy.html'));
    for (const must of [
      'Data Fiduciary', 'What we collect', 'Why we use it', 'Who helps us', 'How long we keep it', 'How we protect it',
      'Your rights', 'Data Protection Board of India', 'Grievance Officer', 'withdraw', 'Eighth Schedule',
    ]) expect(privacy, must).toContain(must);
  });

  it('the policy lists every cookie the dashboard sets', () => {
    const privacy = page('privacy.html');
    const names = new Set<string>();
    for (const file of sourceFiles(APP_SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/COOKIE\s*=\s*'([a-z_]+)'/g)) names.add(m[1]);
    }
    expect([...names].sort()).toEqual(expect.arrayContaining(['esp_access', 'esp_refresh', 'fb_home', 'fb_lang']));
    for (const name of names) expect(privacy, `cookie ${name}`).toContain(`<code>${name}</code>`);
  });

  it('every table cell carries its column name, for the phone layout', () => {
    for (const name of ['privacy.html', 'terms.html']) {
      const html = page(name);
      expect(html.match(/<td>/g) ?? [], name).toEqual([]);
    }
  });

  it('nothing is left to fill in', () => {
    for (const name of ['privacy.html', 'terms.html']) {
      expect(page(name), name).not.toMatch(/class="todo"|\[[A-Z][^\]]*\]/);
    }
  });
});
