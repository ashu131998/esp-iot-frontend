import { describe, expect, it } from 'vitest';

import {
  englishTranslator,
  interpolate,
  makeTranslator,
  translate,
  translatePlural,
} from '@/lib/i18n/translate';

const hi = {
  'Running': 'चल रही है',
  '{count} machines stopped': '{count} मशीनें रुकी हैं',
  '{count} machine': '{count} मशीन',
  '{count} machines': '{count} मशीनें',
  'Signed in as {name}': '{name} के रूप में साइन इन',
};

describe('interpolate', () => {
  it('fills placeholders and leaves unknown ones as written', () => {
    expect(interpolate('{a} and {b} and {c}', { a: 'x', b: 'y' })).toBe('x and y and {c}');
  });
  it('writes numbers the Indian way and strings as they are', () => {
    expect(interpolate('{n} units', { n: 1234567 })).toBe('12,34,567 units');
    expect(interpolate('year {y}', { y: '2026' })).toBe('year 2026');
  });
  it('shows nothing for null or undefined values', () => {
    expect(interpolate('a{x}b', { x: null })).toBe('ab');
    expect(interpolate('a{x}b', { x: undefined })).toBe('ab');
  });
  it('returns the template untouched without variables', () => {
    expect(interpolate('{keep}')).toBe('{keep}');
  });
});

describe('translate', () => {
  it('returns the Hindi for a known English text', () => {
    expect(translate(hi, 'hi', 'Running')).toBe('चल रही है');
  });
  it('falls back to the English text when there is no translation', () => {
    expect(translate(hi, 'hi', 'Stopped')).toBe('Stopped');
    expect(translate(null, 'en', 'Stopped')).toBe('Stopped');
  });
  it('fills placeholders after translating', () => {
    expect(translate(hi, 'hi', '{count} machines stopped', { count: 3 })).toBe('3 मशीनें रुकी हैं');
    expect(translate(hi, 'hi', 'Signed in as {name}', { name: 'ravi' })).toBe('ravi के रूप में साइन इन');
  });
  it('an empty translation counts as missing (never a blank label)', () => {
    expect(translate({ Running: '' }, 'hi', 'Running')).toBe('Running');
  });
});

describe('translatePlural', () => {
  it('picks the singular for exactly one', () => {
    expect(translatePlural(hi, 'hi', 1, '{count} machine', '{count} machines')).toBe('1 मशीन');
    expect(translatePlural(null, 'en', 1, '{count} machine', '{count} machines')).toBe('1 machine');
  });
  it('picks the plural otherwise, zero included', () => {
    expect(translatePlural(hi, 'hi', 0, '{count} machine', '{count} machines')).toBe('0 मशीनें');
    expect(translatePlural(null, 'en', 25000, '{count} machine', '{count} machines')).toBe('25,000 machines');
  });
  it('lets other variables ride along', () => {
    expect(translatePlural(null, 'en', 2, '{count} loom on {line}', '{count} looms on {line}', { line: 'A' }))
      .toBe('2 looms on A');
  });
});

describe('makeTranslator', () => {
  it('binds the messages and the locale', () => {
    const tr = makeTranslator(hi, 'hi');
    expect(tr.locale).toBe('hi');
    expect(tr.t('Running')).toBe('चल रही है');
    expect(tr.tn(2, '{count} machine', '{count} machines')).toBe('2 मशीनें');
  });
  it('the English translator is the identity with placeholders filled', () => {
    expect(englishTranslator.locale).toBe('en');
    expect(englishTranslator.t('{count} on', { count: 7 })).toBe('7 on');
  });
});
