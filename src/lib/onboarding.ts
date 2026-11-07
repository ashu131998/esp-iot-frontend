/**
 * Onboarding wizard (/internal/onboard): what a factory and its first admins
 * need before they can be created. The rules mirror query-api's onboarding.js
 * and @esp-iot/events/shifts, so a mistake shows on the step where it was made
 * instead of as an error after "Create". The server checks again.
 */

import type { PeriodDraft } from './subscriptions';
import { factorySubdomainProblem } from '@/lib/hosts';

export const MAX_ONBOARD_ADMINS = 10;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 64;

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

// ── Company ─────────────────────────────────────────────────────────────────

/** A company a factory can belong to, with its factories (GET /v1/admin/companies). */
export interface CompanyOption {
  company_id: string;
  name: string;
  factories: { factory_id: string; name: string | null }[];
  /** Its admins: one account each for every factory of the company. */
  admins?: { username: string; email: string | null }[];
}

/**
 * The form's first step: the company the factory belongs to. A group with several plants is one
 * company; each plant is onboarded as a factory under it. `name` is the picked company's in 'existing'.
 */
export interface CompanyDraft {
  mode: 'existing' | 'new';
  company_id: string;
  name: string;
}

export const MAX_COMPANY_NAME = 120;
const tidyName = (s: string) => s.replace(/\s+/g, ' ').trim();

/** What is wrong with the company step (query-api companies.js checks the same). */
export function companyProblems(c: CompanyDraft, companies: CompanyOption[] = []): { company?: string } {
  if (c.mode === 'existing') {
    if (!c.company_id) return { company: 'Pick the company' };
    if (companies.length > 0 && !companies.some((x) => x.company_id === c.company_id)) {
      return { company: 'That company no longer exists: pick another' };
    }
    return {};
  }
  const name = tidyName(c.name);
  if (!name) return { company: 'Enter the company name' };
  if (name.length > MAX_COMPANY_NAME) return { company: `At most ${MAX_COMPANY_NAME} characters` };
  const same = companies.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (same) return { company: `${same.name} is already a company: pick it from the list` };
  return {};
}

// ── Factory ─────────────────────────────────────────────────────────────────

export interface FactoryDraft {
  factory_id: string;
  name: string;
  location: string;
  /** The partner (loom dealer, electrician) who brought the factory in; empty when none. */
  referred_by?: string;
}

/** "Shree Ganesh Mills, Surat" → "shree-ganesh-mills-surat" (a suggested factory ID). */
export function suggestFactoryId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

export type FactoryProblems = Partial<Record<keyof FactoryDraft, string>>;

export function factoryProblems(f: FactoryDraft, takenIds: string[] = []): FactoryProblems {
  const out: FactoryProblems = {};
  const id = f.factory_id.trim();
  if (!f.name.trim()) out.name = 'Enter the factory name';
  if (!id) out.factory_id = 'Enter a factory ID';
  else if (factorySubdomainProblem(id)) out.factory_id = factorySubdomainProblem(id) ?? undefined;
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

/** An admin row nobody filled in. */
export const isBlankAdmin = (a: AdminDraft) => !a.email.trim() && !a.username.trim() && !a.password;

/** The picked company's admins, who sign in at the new factory too (a new company has none). */
export function companyAdminsOf(c: CompanyDraft, companies: CompanyOption[]): { username: string; email: string | null }[] {
  if (c.mode !== 'existing') return [];
  return companies.find((x) => x.company_id === c.company_id)?.admins ?? [];
}

/** The admin rows to check: with the company's admins covering the factory, an empty row is none. */
export function adminRows(d: Pick<SetupDraft, 'company' | 'admins'>, companies: CompanyOption[] = []): AdminDraft[] {
  return companyAdminsOf(d.company, companies).length > 0 ? d.admins.filter((a) => !isBlankAdmin(a)) : d.admins;
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
  referred_by?: string;
}

export function buildOnboardRequest(f: FactoryDraft, shifts: ShiftDraft[], admins: AdminDraft[]): OnboardRequest {
  const referredBy = (f.referred_by ?? '').replace(/\s+/g, ' ').trim();
  return {
    factory_id: f.factory_id.trim(),
    name: f.name.trim(),
    location: f.location.trim(),
    shifts: shifts.map((s) => ({ ...s, shift_id: s.shift_id.trim(), name: s.name.trim() })),
    admins: admins.map((a) => ({ email: a.email.trim().toLowerCase(), username: a.username.trim(), password: a.password })),
    ...(referredBy ? { referred_by: referredBy } : {}),
  };
}

/**
 * The website that goes with a dashboard address, without https:// ("https://app.floorbeat.in" gives
 * "floorbeat.in", "https://stage-app.floorbeat.in" gives "stage-www.floorbeat.in"): its /login takes a
 * factory ID, the way in that survives a badly copied link.
 */
export function siteFromAppUrl(appUrl: string): string {
  const host = appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (host.startsWith('app.')) return host.slice(4);
  const env = /^([a-z0-9]+)-app\.(.+)$/.exec(host);
  if (env) return `${env[1]}-www.${env[2]}`;
  return host;
}

/** Sign-in details to paste into a message, for an admin whose email did not go. */
export function signInDetailsText(
  factoryId: string,
  admin: { email: string; username: string; password: string },
  appUrl: string,
): string {
  return [
    `FloorBeat sign-in for ${factoryId}`,
    `Sign in: ${appUrl}/f/${factoryId}/login`,
    `Link not working? Go to ${siteFromAppUrl(appUrl)}/login and enter factory ID: ${factoryId}`,
    `Email: ${admin.email}`,
    ...(admin.username.toLowerCase() !== admin.email.toLowerCase() ? [`Username: ${admin.username}`] : []),
    `Password: ${admin.password}`,
  ].join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// The whole factory in one go (POST /v1/admin/factories/setup). Only the factory and one admin
// are required; every other step is optional and sent only when something was filled in. The
// rules mirror query-api's factory-setup.js, so problems show on their own step.
// ════════════════════════════════════════════════════════════════════════════


export const SETUP_STEPS = [
  { key: 'company', label: 'Company' },
  { key: 'factory', label: 'Factory' },
  { key: 'look', label: 'Look' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'lines', label: 'Lines & machines' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'boards', label: 'Boards' },
  { key: 'people', label: 'People' },
  { key: 'reports', label: 'Reports & alerts' },
  { key: 'review', label: 'Review' },
] as const;
export type SetupStepKey = (typeof SETUP_STEPS)[number]['key'];

/** The step a server problem belongs to (its `section`). */
export function stepOfSection(section: string): number {
  const i = SETUP_STEPS.findIndex((s) => s.key === section);
  return i < 0 ? 0 : i;
}

export const MAX_WIFI = 8;
export const LOGO_MAX_BYTES = 200 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const WORKER_ROLES = [
  'Machine Operator', 'Helper', 'Maintenance Technician', 'Quality Inspector', 'Shift Supervisor', 'Material Handler', 'Electrician',
];

const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;
const COLOUR_RE = /^#[0-9a-fA-F]{6}$/;
const RESCUE_LINE = 'rescue';

export interface LookDraft {
  accent_color: string;
  logo: { type: string; data: string; name: string; size: number } | null;
  /** Page and section switches changed from their defaults. */
  features: Record<string, boolean>;
}

export interface SubscriptionDraft extends PeriodDraft {
  /** Set one now (else the factory starts without one: not limited). */
  enabled: boolean;
}

export interface LineDraft { key: string; line_id: string; name: string; idEdited: boolean }

export interface MachineDraft {
  key: string;
  line_key: string;
  name: string;
  machine_id: string;
  type: string;
  target_units_per_hour: string;
  target_cycle_time_sec: string;
  voltage_v: string;
  unit_label: string;
}

export interface WifiDraft { key: string; ssid: string; pass: string }

/** The channels a board gets machines for here (REV B's own): CTs on I1–I4, proximity on P1–P2. */
export const SETUP_BOARD_SLOTS = ['I1', 'I2', 'I3', 'I4', 'P1', 'P2'] as const;

/** What a channel measures: a proximity sensor on P slots, a current transformer on the rest. */
export const slotSensor = (slot: string): 'current' | 'proximity' => (slot.startsWith('P') ? 'proximity' : 'current');

/** A board waiting to be claimed, for this factory. */
export interface BoardDraft {
  key: string;
  board_id: string;
  /** A rescue box: claimed into the factory alone (no line, no sensors). */
  rescue: boolean;
  line_key: string;
  /** Channel slot → the machine it measures (the machine's key); not there: not used. */
  channels: Record<string, string>;
}

export interface WorkerDraft {
  key: string;
  name: string;
  role: string;
  employee_code: string;
  phone: string;
  email: string;
  password: string;
}

export interface ContactDraft { key: string; name: string; phone: string }

export interface ReportsDraft {
  /** Shift-report (and monitoring alert) emails, one per line or comma-separated. */
  emails: string;
  mobile_enabled: boolean;
  notify_owner_on_down: boolean;
  owner_contacts: ContactDraft[];
  value_per_loom_hour: string;
  fee_per_machine_month: string;
  setup_fee: string;
  monthly_email: boolean;
}

export interface SetupDraft {
  step: number;
  company: CompanyDraft;
  factory: FactoryDraft;
  idEdited: boolean;
  look: LookDraft;
  subscription: SubscriptionDraft;
  shifts: ShiftDraft[];
  lines: LineDraft[];
  machines: MachineDraft[];
  wifi: WifiDraft[];
  boards: BoardDraft[];
  admins: AdminDraft[];
  workers: WorkerDraft[];
  reports: ReportsDraft;
}

const key = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function emptySetupDraft(today: string): SetupDraft {
  return {
    step: 0,
    company: { mode: 'new', company_id: '', name: '' },
    factory: { factory_id: '', name: '', location: '', referred_by: '' },
    idEdited: false,
    look: { accent_color: '', logo: null, features: {} },
    subscription: {
      enabled: false, starts_on: today, ends_on: '', plan: '', machines: '', monthly_amount: '', notes: '',
    },
    shifts: SHIFT_PRESETS[0].shifts,
    lines: [],
    machines: [],
    wifi: [],
    boards: [],
    admins: [emptyAdmin(key())],
    workers: [],
    reports: {
      emails: '', mobile_enabled: true, notify_owner_on_down: true, owner_contacts: [],
      value_per_loom_hour: '', fee_per_machine_month: '', setup_fee: '', monthly_email: true,
    },
  };
}

export const newLine = (line_id = '', name = ''): LineDraft => ({ key: key(), line_id, name, idEdited: Boolean(line_id) });
export const newMachine = (line_key: string, name = ''): MachineDraft => ({
  key: key(), line_key, name, machine_id: '', type: '', target_units_per_hour: '', target_cycle_time_sec: '', voltage_v: '', unit_label: '',
});
export const newWifi = (): WifiDraft => ({ key: key(), ssid: '', pass: '' });
export const newBoard = (board_id: string, rescue = false): BoardDraft => ({ key: key(), board_id, rescue, line_key: '', channels: {} });
export const newWorker = (): WorkerDraft => ({ key: key(), name: '', role: WORKER_ROLES[0], employee_code: '', phone: '', email: '', password: '' });
export const newContact = (): ContactDraft => ({ key: key(), name: '', phone: '' });

/**
 * Machines named in a run: "Machine #" from 1 to 12 gives Machine #1 … Machine #12, on one line, with the
 * same type and targets. Names already in the list are skipped.
 */
export function bulkMachines(
  { prefix, from, to, line_key, type = '', target_units_per_hour = '' }:
  { prefix: string; from: number; to: number; line_key: string; type?: string; target_units_per_hour?: string },
  existing: ReadonlyArray<MachineDraft> = [],
): MachineDraft[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from >= 500) return [];
  const taken = new Set(existing.map((m) => m.name.trim().toLowerCase()));
  const out: MachineDraft[] = [];
  for (let n = from; n <= to; n += 1) {
    const name = `${prefix}${n}`.trim();
    if (!name || taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    out.push({ ...newMachine(line_key, name), type, target_units_per_hour });
  }
  return out;
}

/** Emails typed one per line or comma-separated: trimmed, lower-cased, each once. */
export function emailList(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

const asNumber = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const badNumber = (v: string, { positive = false } = {}) => {
  const n = asNumber(v);
  return n !== null && (!Number.isFinite(n) || n < 0 || (positive && n === 0));
};

export function lookProblems(l: LookDraft): Partial<Record<'accent_color' | 'logo', string>> {
  const out: Partial<Record<'accent_color' | 'logo', string>> = {};
  if (l.accent_color && !COLOUR_RE.test(l.accent_color)) out.accent_color = 'A colour like #2563eb';
  if (l.logo && !LOGO_TYPES.includes(l.logo.type)) out.logo = 'A PNG, JPEG or WebP image';
  else if (l.logo && l.logo.size > LOGO_MAX_BYTES) out.logo = `At most ${LOGO_MAX_BYTES / 1024} KB`;
  return out;
}

export type LineProblems = Partial<Record<'line_id' | 'name', string>>;

/** Each line needs a label (what the factory's people read) and a valid, distinct ID. */
export function lineProblems(lines: LineDraft[]): LineProblems[] {
  const seen = new Set<string>();
  return lines.map((l) => {
    const out: LineProblems = {};
    if (!l.name.trim()) out.name = 'Enter its label';
    else if (l.name.trim().length > 80) out.name = 'At most 80 characters';
    const id = l.line_id.trim();
    if (!ID_RE.test(id)) out.line_id = 'Letters, digits, - and _ only';
    else if (id === RESCUE_LINE) out.line_id = '"rescue" is kept for the rescue box';
    else if (seen.has(id.toLowerCase())) out.line_id = 'Same ID as another line';
    seen.add(id.toLowerCase());
    return out;
  });
}

export type MachineProblems = Partial<Record<'name' | 'line_key' | 'machine_id' | 'numbers', string>>;

export function machineProblems(machines: MachineDraft[], lines: LineDraft[]): MachineProblems[] {
  const lineKeys = new Set(lines.map((l) => l.key));
  const names = new Set<string>();
  const ids = new Set<string>();
  return machines.map((m) => {
    const out: MachineProblems = {};
    const name = m.name.trim();
    if (!name) out.name = 'Enter a name';
    else if (names.has(name.toLowerCase())) out.name = 'Same name as another machine';
    names.add(name.toLowerCase());
    if (!lineKeys.has(m.line_key)) out.line_key = 'Pick a line';
    const id = m.machine_id.trim();
    if (id && !ID_RE.test(id)) out.machine_id = 'Letters, digits, - and _ only';
    else if (id && ids.has(id.toLowerCase())) out.machine_id = 'Same ID as another machine';
    if (id) ids.add(id.toLowerCase());
    if ([m.target_units_per_hour, m.target_cycle_time_sec, m.voltage_v].some((v) => badNumber(v, { positive: true }))) {
      out.numbers = 'Targets and voltage must be numbers above 0';
    }
    if (m.unit_label.trim().length > 16) out.numbers = 'The unit is at most 16 characters';
    return out;
  });
}

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export function wifiProblems(list: WifiDraft[]): Partial<Record<'ssid' | 'pass', string>>[] {
  const seen = new Set<string>();
  return list.map((n) => {
    const out: Partial<Record<'ssid' | 'pass', string>> = {};
    const ssid = n.ssid.trim();
    const bytes = utf8Bytes(ssid);
    if (bytes < 1 || bytes > 32) out.ssid = 'The network name, 1–32 characters';
    else if (seen.has(ssid)) out.ssid = 'Listed twice';
    seen.add(ssid);
    if (n.pass !== '' && (n.pass.length < 8 || n.pass.length > 63 || !/^[\x20-\x7e]+$/.test(n.pass))) {
      out.pass = '8–63 plain characters, or empty for an open network';
    }
    return out;
  });
}

export type BoardProblems = Partial<Record<'line_key' | 'channels', string>>;

/**
 * Each board on one of the form's lines (a rescue box needs none), its channels on machines that
 * are still in the form. A machine may have several sensors of a kind: the first current sensor
 * listed decides whether it runs, and every proximity sensor's pulses count towards it.
 */
export function boardProblems(boards: BoardDraft[], lines: LineDraft[], machines: MachineDraft[]): BoardProblems[] {
  const lineKeys = new Set(lines.map((l) => l.key));
  const machineName = new Map(machines.map((m) => [m.key, m.name.trim()]));
  return boards.map((b) => {
    const out: BoardProblems = {};
    if (b.rescue) return out;
    if (!lineKeys.has(b.line_key)) out.line_key = lines.length === 0 ? 'Add its line first, on Lines & machines' : 'Pick its line';
    for (const slot of SETUP_BOARD_SLOTS) {
      const machineKey = b.channels[slot];
      if (!machineKey) continue;
      if (!machineName.get(machineKey)) out.channels ??= `${slot}: its machine was removed; pick another`;
    }
    return out;
  });
}

export type WorkerProblems = Partial<Record<'name' | 'email' | 'password' | 'phone', string>>;

export function workerProblems(workers: WorkerDraft[]): WorkerProblems[] {
  const emails = new Set<string>();
  return workers.map((w) => {
    const out: WorkerProblems = {};
    if (!w.name.trim()) out.name = 'Enter a name';
    const email = w.email.trim().toLowerCase();
    if (email && !isValidEmail(email)) out.email = 'Not a valid email';
    else if (email && emails.has(email)) out.email = 'Same email as another worker';
    if (email) emails.add(email);
    if (w.password && !email) out.password = 'An app login needs an email too';
    else if (w.password && w.password.length < MIN_PASSWORD_LENGTH) out.password = `At least ${MIN_PASSWORD_LENGTH} characters`;
    if (w.phone.trim() && !PHONE_RE.test(w.phone.trim())) out.phone = 'Not a phone number';
    return out;
  });
}

export type ReportsProblems = Partial<Record<'emails' | 'contacts' | 'money', string>>;

export function reportsProblems(r: ReportsDraft): ReportsProblems {
  const out: ReportsProblems = {};
  const bad = emailList(r.emails).filter((e) => !isValidEmail(e));
  if (bad.length > 0) out.emails = `Not an email: ${bad.join(', ')}`;
  const badContact = r.owner_contacts.find((c) => !PHONE_RE.test(c.phone.trim()));
  if (badContact) out.contacts = `Not a phone number: ${badContact.phone || '(empty)'}`;
  if ([r.value_per_loom_hour, r.fee_per_machine_month, r.setup_fee].some((v) => badNumber(v))) out.money = 'Amounts must be numbers';
  return out;
}

/** Whether each step is fine to leave (Review is always fine). */
export function setupStepsOk(
  d: SetupDraft, takenIds: string[] = [], periodProblems: (p: PeriodDraft) => object = () => ({}), companies: CompanyOption[] = [],
): boolean[] {
  return SETUP_STEPS.map(({ key: step }) => {
    switch (step) {
      case 'company': return !hasProblems(companyProblems(d.company, companies));
      case 'factory': return !hasProblems(factoryProblems(d.factory, takenIds));
      case 'look': return !hasProblems(lookProblems(d.look));
      case 'subscription': return !d.subscription.enabled || !hasProblems(periodProblems(d.subscription));
      case 'shifts': return shiftProblem(d.shifts) === null;
      case 'lines': return !hasProblems(lineProblems(d.lines)) && !hasProblems(machineProblems(d.machines, d.lines));
      case 'wifi': return !hasProblems(wifiProblems(d.wifi));
      case 'boards': return !hasProblems(boardProblems(d.boards, d.lines, d.machines));
      case 'people': return !hasProblems(adminProblems(adminRows(d, companies))) && !hasProblems(workerProblems(d.workers));
      case 'reports': return !hasProblems(reportsProblems(d.reports));
      default: return true;
    }
  });
}

export interface SetupRequest {
  /** The company picked, or a new one (query-api companies.js). */
  company: { company_id: string } | { name: string };
  factory: { factory_id: string; name: string; location: string; referred_by?: string };
  shifts: ShiftDraft[];
  admins: { email: string; username: string; password: string }[];
  look?: { accent_color?: string; logo?: { type: string; data: string }; features?: Record<string, boolean> };
  subscription?: { starts_on: string; ends_on: string; plan: string | null; machines: number | null; monthly_amount: number | null; notes: string | null };
  lines?: { line_id: string; name: string }[];
  machines?: Record<string, string | number>[];
  wifi?: { ssid: string; pass: string }[];
  boards?: { board_id: string; line_id?: string; channels?: { slot: string; machine: string }[] }[];
  workers?: { name: string; role: string; employee_code?: string; phone?: string; email?: string; password?: string }[];
  reports?: { enabled: boolean; recipient_emails: string[] };
  alerts?: { mobile_enabled: boolean; notify_owner_on_down: boolean; owner_contacts: { name: string; phone: string }[] };
  results?: { value_per_loom_hour?: number; fee_per_machine_month?: number; setup_fee?: number; monthly_email: boolean };
}

export interface SetupResponse {
  company?: { company_id: string; name: string };
  factory: import('./types').Factory;
  admins: import('./auth-types').AuthUser[];
  emails: { username: string; email: string; sent: boolean; error?: string }[];
  lines: number;
  machines: number;
  wifi: number;
  workers: { worker_id: string; name: string; app_login: string }[];
  /** Each board's claim: "claimed", or "failed: …" (claim it again on the Boards page). */
  boards?: { board_id: string; rescue: boolean; line_id: string | null; channels: number; claim: string }[];
  dashboard_url: string;
}

const clean = (v: string) => v.replace(/\s+/g, ' ').trim();

/** The form as the API takes it: required parts always, the rest only when filled in. */
export function buildSetupRequest(d: SetupDraft, body: (p: PeriodDraft) => SetupRequest['subscription']): SetupRequest {
  // An empty admin row is never sent (it only passes the checks when the company's admins cover it).
  const base = buildOnboardRequest(d.factory, d.shifts, d.admins.filter((a) => !isBlankAdmin(a)));
  const req: SetupRequest = {
    company: d.company.mode === 'existing' ? { company_id: d.company.company_id } : { name: tidyName(d.company.name) },
    factory: {
      factory_id: base.factory_id, name: base.name, location: base.location,
      ...(base.referred_by ? { referred_by: base.referred_by } : {}),
    },
    shifts: base.shifts,
    admins: base.admins,
  };
  const look: NonNullable<SetupRequest['look']> = {};
  if (d.look.accent_color) look.accent_color = d.look.accent_color.toLowerCase();
  if (d.look.logo) look.logo = { type: d.look.logo.type, data: d.look.logo.data };
  if (Object.keys(d.look.features).length > 0) look.features = d.look.features;
  if (Object.keys(look).length > 0) req.look = look;
  if (d.subscription.enabled) req.subscription = body(d.subscription);
  const lineIdOf = new Map(d.lines.map((l) => [l.key, l.line_id.trim()]));
  if (d.lines.length > 0) req.lines = d.lines.map((l) => ({ line_id: l.line_id.trim(), name: clean(l.name) }));
  if (d.machines.length > 0) {
    req.machines = d.machines.map((m) => {
      const out: Record<string, string | number> = { line_id: lineIdOf.get(m.line_key) ?? '', name: clean(m.name) };
      if (m.machine_id.trim()) out.machine_id = m.machine_id.trim();
      if (clean(m.type)) out.type = clean(m.type);
      if (clean(m.unit_label)) out.unit_label = clean(m.unit_label);
      for (const k of ['target_units_per_hour', 'target_cycle_time_sec', 'voltage_v'] as const) {
        const n = asNumber(m[k]);
        if (n !== null) out[k] = n;
      }
      return out;
    });
  }
  if (d.wifi.length > 0) req.wifi = d.wifi.map((n) => ({ ssid: n.ssid.trim(), pass: n.pass }));
  if (d.boards.length > 0) {
    // Machines by name: the server makes their IDs.
    const machineName = new Map(d.machines.map((m) => [m.key, clean(m.name)]));
    req.boards = d.boards.map((b) => {
      const channels = SETUP_BOARD_SLOTS
        .filter((slot) => machineName.has(b.channels[slot] ?? ''))
        .map((slot) => ({ slot, machine: machineName.get(b.channels[slot]) ?? '' }));
      const lineId = b.rescue ? '' : (lineIdOf.get(b.line_key) ?? '');
      return { board_id: b.board_id, ...(lineId ? { line_id: lineId } : {}), ...(channels.length > 0 ? { channels } : {}) };
    });
  }
  if (d.workers.length > 0) {
    req.workers = d.workers.map((w) => ({
      name: clean(w.name),
      role: clean(w.role) || WORKER_ROLES[0],
      ...(clean(w.employee_code) ? { employee_code: clean(w.employee_code) } : {}),
      ...(w.phone.trim() ? { phone: w.phone.trim() } : {}),
      ...(w.email.trim() ? { email: w.email.trim().toLowerCase() } : {}),
      ...(w.password ? { password: w.password } : {}),
    }));
  }
  const emails = emailList(d.reports.emails);
  if (emails.length > 0) req.reports = { enabled: true, recipient_emails: emails };
  req.alerts = {
    mobile_enabled: d.reports.mobile_enabled,
    notify_owner_on_down: d.reports.notify_owner_on_down,
    owner_contacts: d.reports.owner_contacts.map((c) => ({ name: clean(c.name), phone: c.phone.trim() })),
  };
  const money: NonNullable<SetupRequest['results']> = { monthly_email: d.reports.monthly_email };
  for (const k of ['value_per_loom_hour', 'fee_per_machine_month', 'setup_fee'] as const) {
    const n = asNumber(d.reports[k]);
    if (n !== null) money[k] = n;
  }
  if (Object.keys(money).length > 1 || !d.reports.monthly_email) req.results = money;
  return req;
}
