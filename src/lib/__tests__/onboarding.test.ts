import { describe, expect, it } from 'vitest';

import {
  MAX_USERNAME_LENGTH, SHIFT_PRESETS, addShift, adminProblems, buildOnboardRequest, emptyAdmin, factoryProblems,
  generatePassword, hasProblems, isValidEmail, setAdminEmail, setAdminUsername, shiftLabel, shiftProblem,
  signInDetailsText, suggestFactoryId, type AdminDraft, type ShiftDraft,
} from '../onboarding';

const admin = (email: string, password = 'password1', key = email): AdminDraft => setAdminEmail({ ...emptyAdmin(key), password }, email);

describe('suggestFactoryId', () => {
  it.each([
    ['Shree Ganesh Mills, Surat', 'shree-ganesh-mills-surat'],
    ['  Café  Délhi  03 ', 'cafe-delhi-03'],
    ['--Mill__One--', 'mill-one'],
    ['', ''],
  ])('%s → %s', (name, id) => expect(suggestFactoryId(name)).toBe(id));

  it('never longer than 64 and never ends in -', () => {
    const id = suggestFactoryId(`${'a'.repeat(63)} b`);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.endsWith('-')).toBe(false);
  });
});

describe('factoryProblems', () => {
  it('fine', () => expect(factoryProblems({ factory_id: 'mill-01', name: 'Mill', location: '' })).toEqual({}));
  it('name and ID required; ID characters; ID already taken (any case)', () => {
    expect(factoryProblems({ factory_id: '', name: ' ', location: '' })).toEqual({
      name: 'Enter the factory name', factory_id: 'Enter a factory ID',
    });
    expect(factoryProblems({ factory_id: 'mill 01', name: 'M', location: '' }).factory_id).toMatch(/Only letters/);
    expect(factoryProblems({ factory_id: 'Mill-01', name: 'M', location: '' }, ['mill-01']).factory_id).toMatch(/already exists/);
  });
});

describe('shifts', () => {
  it('every preset tiles the day', () => {
    for (const p of SHIFT_PRESETS) expect(shiftProblem(p.shifts)).toBeNull();
  });

  it('labels wrap past midnight', () => {
    expect(shiftLabel({ start_hour: 22, duration_hours: 8 })).toBe('22:00 – 06:00');
    expect(shiftLabel({ start_hour: 0, duration_hours: 24 })).toBe('00:00 – 00:00');
  });

  const two: ShiftDraft[] = SHIFT_PRESETS[0].shifts;
  it.each<[string, ShiftDraft[], string]>([
    ['none', [], 'Add at least one shift'],
    ['seven', Array.from({ length: 7 }, (_, i) => ({ shift_id: `S${i}`, name: 'x', start_hour: i, duration_hours: 1 })), 'At most 6'],
    ['no code', [{ ...two[0], shift_id: ' ' }, two[1]], 'short code'],
    ['no name', [{ ...two[0], name: '' }, two[1]], 'Shift A: enter a name'],
    ['bad start', [{ ...two[0], start_hour: 24 }, two[1]], 'whole hour'],
    ['bad length', [{ ...two[0], duration_hours: 0 }, two[1]], '1–24 hours'],
    ['same code', [two[0], { ...two[1], shift_id: 'A' }], 'must be different'],
    ['not 24 h', [two[0], { ...two[1], duration_hours: 10 }], 'add up to 24 h (now 22 h)'],
    ['gap', [{ ...two[0], duration_hours: 11 }, { ...two[1], duration_hours: 13 }], 'Shift A ends at 17:00 but shift B starts at 18:00'],
  ])('%s', (_, shifts, msg) => expect(shiftProblem(shifts)).toContain(msg));

  it('adding a shift splits the last one, so the day still tiles', () => {
    const three = addShift(two);
    expect(three.map((s) => [s.shift_id, s.start_hour, s.duration_hours])).toEqual([['A', 6, 12], ['B', 18, 6], ['C', 0, 6]]);
    expect(shiftProblem(three)).toBeNull();
    expect(shiftProblem(addShift([]))).toBeNull();
    const ones = addShift([{ shift_id: 'A', name: 'x', start_hour: 0, duration_hours: 1 }]);
    expect(ones).toHaveLength(2);   // a 1 h shift cannot be split: the new one needs fixing by hand
  });
});

describe('admins', () => {
  it('the username follows the email until it is edited', () => {
    let a = setAdminEmail(emptyAdmin('k'), ' ravi@mill.in ');
    expect(a.username).toBe('ravi@mill.in');
    a = setAdminUsername(a, 'ravi');
    a = setAdminEmail(a, 'ravi.k@mill.in');
    expect([a.email, a.username]).toEqual(['ravi.k@mill.in', 'ravi']);
  });

  it('fine', () => {
    const p = adminProblems([admin('ravi@mill.in'), admin('sita@mill.in')]);
    expect(p).toEqual([{}, {}]);
    expect(hasProblems(p)).toBe(false);
  });

  it('email required and valid; password 8+; username 3–64', () => {
    const long = setAdminUsername(admin('a@b.in'), 'x'.repeat(MAX_USERNAME_LENGTH + 1));
    expect(adminProblems([admin(''), admin('nope', 'short'), setAdminUsername(admin('x@y.in'), 'ab'), long])).toEqual([
      { email: 'Email is required', username: 'At least 3 characters' },
      { email: 'Not a valid email', password: 'At least 8 characters' },
      { username: 'At least 3 characters' },
      { username: 'At most 64 characters' },
    ]);
  });

  it('the same email or username twice: the second is flagged (ignoring case)', () => {
    expect(adminProblems([admin('ravi@mill.in'), admin('RAVI@mill.in')])[1]).toEqual({
      email: 'Same email as another admin', username: 'Same username as another admin',
    });
  });

  it('hasProblems on one object too', () => {
    expect(hasProblems({})).toBe(false);
    expect(hasProblems({ name: 'x' })).toBe(true);
  });

  it('isValidEmail', () => {
    expect(isValidEmail('a@b.in')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@b.in`)).toBe(false);
  });
});

describe('generatePassword', () => {
  it('12 characters, none of 0 O 1 l I', () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(12);
    expect(pw).not.toMatch(/[0O1lI]/);
  });

  it('skips bytes that would bias the choice', () => {
    let call = 0;
    const bytes = (n: number) => (call++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(0));
    expect(generatePassword(bytes, 4)).toBe('aaaa');   // 255 is above the unbiased limit, 0 → 'a'
  });
});

describe('buildOnboardRequest', () => {
  it('trimmed, emails lower-cased, passwords exactly as typed', () => {
    const req = buildOnboardRequest(
      { factory_id: ' mill-01 ', name: ' Mill ', location: ' Surat ' },
      [{ shift_id: ' A ', name: ' All ', start_hour: 0, duration_hours: 24 }],
      [{ ...admin(' Ravi@Mill.in ', ' pw with space '), username: 'Ravi' }],
    );
    expect(req).toEqual({
      factory_id: 'mill-01', name: 'Mill', location: 'Surat',
      shifts: [{ shift_id: 'A', name: 'All', start_hour: 0, duration_hours: 24 }],
      admins: [{ email: 'ravi@mill.in', username: 'Ravi', password: ' pw with space ' }],
    });
  });
});

describe('signInDetailsText', () => {
  it('username only when it is not the email', () => {
    const app = 'https://app.floorbeat.in';
    expect(signInDetailsText('mill-01', { email: 'a@b.in', username: 'a@b.in', password: 'pw' }, app)).toBe(
      'FloorBeat sign-in for mill-01\nDashboard: https://app.floorbeat.in/f/mill-01/login\nEmail: a@b.in\nPassword: pw',
    );
    expect(signInDetailsText('mill-01', { email: 'a@b.in', username: 'ravi', password: 'pw' }, app)).toContain('Username: ravi');
  });
});
