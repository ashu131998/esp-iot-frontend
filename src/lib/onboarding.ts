/**
 * Onboarding wizard (/internal/onboard): what a factory and its first admins
 * need before they can be created. The rules mirror query-api's onboarding.js
 * and @esp-iot/events/shifts, so a mistake shows on the step where it was made
 * instead of as an error after "Create". The server checks again.
 */

export const MAX_ONBOARD_ADMINS = 10;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 64;

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

// ── Factory ─────────────────────────────────────────────────────────────────

export interface FactoryDraft {
  factory_id: string;
  name: string;
  location: string;
}

/** "Shree Ganesh Mills, Surat" → "shree-ganesh-mills-surat" (a suggested factory ID). */
export function suggestFactoryId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

export type FactoryProblems = Partial<Record<keyof FactoryDraft, string>>;

export function factoryProblems(f: FactoryDraft, takenIds: string[] = []): FactoryProblems {
  const out: FactoryProblems = {};
  const id = f.factory_id.trim();
  if (!f.name.trim()) out.name = 'Enter the factory name';
  if (!id) out.factory_id = 'Enter a factory ID';
  else if (!ID_RE.test(id)) out.factory_id = 'Only letters, digits, - and _ (up to 64)';
  else if (takenIds.some((t) => t.toLowerCase() === id.toLowerCase())) out.factory_id = 'A factory with this ID already exists';
  return out;
}

// ── Shifts ──────────────────────────────────────────────────────────────────

export interface ShiftDraft {
  shift_id: string;
  name: string;
  start_hour: number;
  duration_hours: number;
}

export const SHIFT_PRESETS: { key: string; label: string; shifts: ShiftDraft[] }[] = [
  {
    key: '2x12',
    label: '2 shifts × 12 h',
    shifts: [
      { shift_id: 'A', name: 'Day Shift', start_hour: 6, duration_hours: 12 },
      { shift_id: 'B', name: 'Night Shift', start_hour: 18, duration_hours: 12 },
    ],
  },
  {
    key: '3x8',
    label: '3 shifts × 8 h',
    shifts: [
      { shift_id: 'A', name: 'Morning Shift', start_hour: 6, duration_hours: 8 },
      { shift_id: 'B', name: 'Evening Shift', start_hour: 14, duration_hours: 8 },
      { shift_id: 'C', name: 'Night Shift', start_hour: 22, duration_hours: 8 },
    ],
  },
  {
    key: '1x24',
    label: '1 shift × 24 h',
    shifts: [{ shift_id: 'A', name: 'All Day', start_hour: 0, duration_hours: 24 }],
  },
];

const hh = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;

/** "06:00 – 18:00". */
export function shiftLabel(s: Pick<ShiftDraft, 'start_hour' | 'duration_hours'>): string {
  return `${hh(s.start_hour)} – ${hh(s.start_hour + s.duration_hours)}`;
}

/** What is wrong with a shift schedule (the server's rules), or null when it tiles the day. */
export function shiftProblem(shifts: ShiftDraft[]): string | null {
  if (shifts.length === 0) return 'Add at least one shift';
  if (shifts.length > 6) return 'At most 6 shifts per day';
  for (const s of shifts) {
    if (!s.shift_id.trim()) return 'Every shift needs a short code (A, B, …)';
    if (!s.name.trim()) return `Shift ${s.shift_id}: enter a name`;
    if (!Number.isInteger(s.start_hour) || s.start_hour < 0 || s.start_hour > 23) {
      return `Shift ${s.shift_id}: start must be a whole hour 0–23`;
    }
    if (!Number.isInteger(s.duration_hours) || s.duration_hours < 1 || s.duration_hours > 24) {
      return `Shift ${s.shift_id}: length must be 1–24 hours`;
    }
  }
  if (new Set(shifts.map((s) => s.shift_id.trim())).size !== shifts.length) return 'Shift codes must be different';
  const total = shifts.reduce((n, s) => n + s.duration_hours, 0);
  if (total !== 24) return `Shifts must add up to 24 h (now ${total} h)`;
  const sorted = [...shifts].sort((a, b) => a.start_hour - b.start_hour);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const nxt = sorted[(i + 1) % sorted.length];
    const end = (cur.start_hour + cur.duration_hours) % 24;
    if (end !== nxt.start_hour) {
      return `Shift ${cur.shift_id} ends at ${hh(end)} but shift ${nxt.shift_id} starts at ${hh(nxt.start_hour)}`;
    }
  }
  return null;
}

/** A new shift that starts where the last one ends (half of its time handed over). */
export function addShift(shifts: ShiftDraft[]): ShiftDraft[] {
  const used = new Set(shifts.map((s) => s.shift_id));
  const code = 'ABCDEF'.split('').find((c) => !used.has(c)) ?? String(shifts.length + 1);
  if (shifts.length === 0) return [{ shift_id: code, name: `Shift ${code}`, start_hour: 0, duration_hours: 24 }];
  const last = shifts[shifts.length - 1];
  const give = Math.floor(last.duration_hours / 2);
  if (give < 1) return [...shifts, { shift_id: code, name: `Shift ${code}`, start_hour: last.start_hour, duration_hours: 1 }];
  return [
    ...shifts.slice(0, -1),
    { ...last, duration_hours: last.duration_hours - give },
    { shift_id: code, name: `Shift ${code}`, start_hour: (last.start_hour + last.duration_hours - give) % 24, duration_hours: give },
  ];
}

// ── Admins ──────────────────────────────────────────────────────────────────

export interface AdminDraft {
  /** Local key for React lists only. */
  key: string;
  email: string;
  username: string;
  /** False until someone edits the username: until then it follows the email. */
  usernameEdited: boolean;
  password: string;
}

export function emptyAdmin(key: string): AdminDraft {
  return { key, email: '', username: '', usernameEdited: false, password: '' };
}

/** Typing an email also fills the username, until the username is edited by hand. */
export function setAdminEmail(a: AdminDraft, email: string): AdminDraft {
  return a.usernameEdited ? { ...a, email } : { ...a, email, username: email.trim() };
}

export function setAdminUsername(a: AdminDraft, username: string): AdminDraft {
  return { ...a, username, usernameEdited: true };
}

export type AdminProblems = Partial<Record<'email' | 'username' | 'password', string>>;

/** Per admin, in order: what is wrong with each field (empty object when fine). */
export function adminProblems(admins: AdminDraft[]): AdminProblems[] {
  const seenEmail = new Set<string>();
  const seenUser = new Set<string>();
  return admins.map((a) => {
    const out: AdminProblems = {};
    const email = a.email.trim().toLowerCase();
    const username = a.username.trim();
    if (!email) out.email = 'Email is required';
    else if (!isValidEmail(email)) out.email = 'Not a valid email';
    else if (seenEmail.has(email)) out.email = 'Same email as another admin';
    if (username.length < MIN_USERNAME_LENGTH) out.username = `At least ${MIN_USERNAME_LENGTH} characters`;
    else if (username.length > MAX_USERNAME_LENGTH) out.username = `At most ${MAX_USERNAME_LENGTH} characters`;
    else if (seenUser.has(username.toLowerCase())) out.username = 'Same username as another admin';
    if (a.password.length < MIN_PASSWORD_LENGTH) out.password = `At least ${MIN_PASSWORD_LENGTH} characters`;
    if (email) seenEmail.add(email);
    if (username) seenUser.add(username.toLowerCase());
    return out;
  });
}

export function hasProblems(p: object | object[]): boolean {
  return Array.isArray(p) ? p.some((x) => Object.keys(x).length > 0) : Object.keys(p).length > 0;
}

// Easy to read aloud or type from a phone: no 0/O, 1/l/I.
const PASSWORD_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A 12-character password. `randomBytes` is injectable for tests. */
export function generatePassword(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
  length = 12,
): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % PASSWORD_CHARS.length);
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out.push(PASSWORD_CHARS[b % PASSWORD_CHARS.length]);
    }
  }
  return out.join('');
}

// ── Request ─────────────────────────────────────────────────────────────────

export interface OnboardRequest {
  factory_id: string;
  name: string;
  location: string;
  shifts: ShiftDraft[];
  admins: { email: string; username: string; password: string }[];
}

export function buildOnboardRequest(f: FactoryDraft, shifts: ShiftDraft[], admins: AdminDraft[]): OnboardRequest {
  return {
    factory_id: f.factory_id.trim(),
    name: f.name.trim(),
    location: f.location.trim(),
    shifts: shifts.map((s) => ({ ...s, shift_id: s.shift_id.trim(), name: s.name.trim() })),
    admins: admins.map((a) => ({ email: a.email.trim().toLowerCase(), username: a.username.trim(), password: a.password })),
  };
}

/** Sign-in details to paste into a message, for an admin whose email did not go. */
export function signInDetailsText(
  factoryId: string,
  admin: { email: string; username: string; password: string },
  appUrl: string,
): string {
  return [
    `FloorBeat sign-in for ${factoryId}`,
    `Dashboard: ${appUrl}/f/${factoryId}/login`,
    `Email: ${admin.email}`,
    ...(admin.username.toLowerCase() !== admin.email.toLowerCase() ? [`Username: ${admin.username}`] : []),
    `Password: ${admin.password}`,
  ].join('\n');
}
