/**
 * The details a stock-in asks for, set per factory by our staff on ops.floorbeat.in (Stock details page,
 * components/internal/stock-details-panel.tsx) and asked on the phone at Add stock (stock-in-screen.tsx).
 * The server's rules are query-api ims.js parseSpecField / parseDetails / missingFields; these mirror them so
 * a form never sends what the server would refuse.
 *
 *  - choice (pick-list): the pallet's specs; it splits stock rows and filters Available stock.
 *  - text, number: the pallet's `details`.
 *  - photo, audio, video: files kept with the pallet and the field.
 *
 * A field's key and type are fixed once made (old pallets are saved with them); removing one only hides it.
 */
import type { ApiSetup } from './types';

export const FIELD_TYPES = ['choice', 'text', 'number', 'photo', 'audio', 'video'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** What the ops page calls each type (staff console: English only). */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  choice: 'Pick-list',
  text: 'Text',
  number: 'Number',
  photo: 'Photo',
  audio: 'Audio',
  video: 'Video',
};

/** The types the phone app can ask for in this version (audio and video come next). */
export const PHONE_TYPES: readonly FieldType[] = ['choice', 'text', 'number', 'photo'];

export interface FieldChoice {
  value: string;
  label: string;
}

/** A field as GET …/ims/setup (`fields`) and GET …/ims/spec-fields send it. */
export interface ApiField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: FieldChoice[];
  sort: number;
  /** A number's unit, shown next to it ("kg"); null for the others. */
  unit?: string | null;
  /** A photo, audio or video may be chosen from the phone's library (false: taken now only). */
  allow_library?: boolean;
  /** Removed: not asked any more; still in setup so old pallets' values keep their labels. */
  archived?: boolean;
}

/** GET …/ims/spec-fields: the fields in their order, and the removed ones (kept on old pallets). */
export interface ApiFieldList {
  fields: ApiField[];
  removed: ApiField[];
}

export const MAX_FIELDS = 20;
export const MAX_CHOICES = 100;
export const LABEL_MAX = 40;
export const TEXT_MAX = 200;
export const NUMBER_MAX = 1e12;
export const UNIT_MAX = 12;
/** The files the server keeps for a field (query-api ims-routes.js MEDIA_MAX); photos are made small to 1 MB. */
export const MEDIA_MAX_BYTES = { audio: 5 * 1024 * 1024, video: 25 * 1024 * 1024 } as const;
export const MEDIA_SECONDS_MAX = 30;
export const MEDIA_TYPES: readonly FieldType[] = ['photo', 'audio', 'video'];
export const isMediaType = (type: FieldType) => MEDIA_TYPES.includes(type);

const KEY_RE = /^[a-z][a-z0-9_]{0,29}$/;
const VALUE_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** A label as the server keeps it: spaces run together and trimmed. */
export const cleanLabel = (label: string): string => label.replace(/\s+/g, ' ').trim();

function slug(label: string): string {
  return cleanLabel(label).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function unique(base: string, taken: Iterable<string>, max: number): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const tail = `_${n}`;
    const candidate = `${base.slice(0, max - tail.length)}${tail}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * A new field's key from its label ("Grade (A/B)" → grade_a_b), never one the factory has or had (`taken`
 * holds removed keys too: the server refuses those, old pallets still have them). A label with no Latin
 * letters (Hindi) gets field, field_2…
 */
export function keyFromLabel(label: string, taken: Iterable<string>): string {
  let base = slug(label).slice(0, 30).replace(/_+$/, '');
  if (!/^[a-z]/.test(base)) base = base ? `f_${base}`.slice(0, 30).replace(/_+$/, '') : 'field';
  const used = [...taken, ...RESERVED_KEYS];
  const key = unique(base, used, 30);
  return KEY_RE.test(key) ? key : unique('field', used, 30);
}

/**
 * Keys a field may never have: `order` is a path of its own (PUT …/spec-fields/order), so a field called
 * that could never be edited (Code Reviewer, 2026-11-26).
 */
export const RESERVED_KEYS: readonly string[] = ['order'];

/** A new choice's value from its label ("Light grey" → light_grey), unique within the field. */
export function valueFromLabel(label: string, taken: Iterable<string>): string {
  let base = slug(label).slice(0, 40).replace(/_+$/, '');
  if (!base) base = 'choice';
  const value = unique(base, taken, 40);
  return VALUE_RE.test(value) ? value : unique('choice', taken, 40);
}

/** One choice as the form edits it: its value once saved (fixed: pallets keep it), its label typed. */
export interface ChoiceDraft {
  value: string | null;
  label: string;
}

/** The field form's state on the ops page. */
export interface FieldDraft {
  label: string;
  type: FieldType;
  required: boolean;
  choices: ChoiceDraft[];
  /** a number's unit ("kg"), may be empty */
  unit: string;
  /** a photo, audio or video: the library button shown on the phone */
  allowLibrary: boolean;
}

export function emptyDraft(): FieldDraft {
  return { label: '', type: 'choice', required: false, choices: [{ value: null, label: '' }], unit: '', allowLibrary: true };
}

export function draftOf(field: ApiField): FieldDraft {
  return {
    label: field.label,
    type: field.type,
    required: field.required,
    choices: field.options.map((o) => ({ value: o.value, label: o.label })),
    unit: field.unit ?? '',
    allowLibrary: field.allow_library !== false,
  };
}

/**
 * What is wrong with a field form, in the console's words, or null when the server will take it: a label,
 * and for a pick-list at least one choice, each labelled once.
 */
export function draftProblem(draft: FieldDraft): string | null {
  const label = cleanLabel(draft.label);
  if (!label) return 'Give the field a name.';
  if (label.length > LABEL_MAX) return `The name is longer than ${LABEL_MAX} characters.`;
  if (!FIELD_TYPES.includes(draft.type)) return 'Pick a type.';
  if (draft.type === 'number' && cleanLabel(draft.unit).length > UNIT_MAX) return `The unit is longer than ${UNIT_MAX} characters.`;
  if (draft.type !== 'choice') return null;
  const labels = draft.choices.map((c) => cleanLabel(c.label)).filter(Boolean);
  if (labels.length === 0) return 'Give at least one choice.';
  if (labels.length > MAX_CHOICES) return `At most ${MAX_CHOICES} choices.`;
  if (labels.some((l) => l.length > LABEL_MAX)) return `A choice is longer than ${LABEL_MAX} characters.`;
  const seen = new Set<string>();
  for (const l of labels) {
    const k = l.toLowerCase();
    if (seen.has(k)) return `"${l}" is there twice.`;
    seen.add(k);
  }
  return null;
}

/** A pick-list's choices to send: saved ones keep their value, new ones get one; empty rows are left out. */
export function choicesToSend(choices: ChoiceDraft[]): FieldChoice[] {
  const kept = choices.filter((c) => cleanLabel(c.label));
  const taken = kept.map((c) => c.value).filter((v): v is string => Boolean(v));
  const out: FieldChoice[] = [];
  for (const c of kept) {
    let value = c.value;
    if (!value) {
      value = valueFromLabel(c.label, taken);
      taken.push(value);
    }
    out.push({ value, label: cleanLabel(c.label) });
  }
  return out;
}

/** What only some types carry: a pick-list's choices, a number's unit (null: none), a file's library switch. */
function typeParts(draft: FieldDraft) {
  return {
    ...(draft.type === 'choice' ? { options: choicesToSend(draft.choices) } : {}),
    ...(draft.type === 'number' ? { unit: cleanLabel(draft.unit) || null } : {}),
    ...(isMediaType(draft.type) ? { allow_library: draft.allowLibrary } : {}),
  };
}

/** POST …/ims/spec-fields for a new field (it goes last). */
export function newFieldBody(draft: FieldDraft, takenKeys: Iterable<string>) {
  const label = cleanLabel(draft.label);
  return { key: keyFromLabel(label, takenKeys), label, type: draft.type, required: draft.required, ...typeParts(draft) };
}

/** PUT …/ims/spec-fields/:key for an edit (the key and type stay). */
export function editFieldBody(draft: FieldDraft) {
  return { label: cleanLabel(draft.label), required: draft.required, ...typeParts(draft) };
}

/** The keys with one moved up (-1) or down (+1); the same list when it cannot move. */
export function moveKey(keys: string[], key: string, delta: -1 | 1): string[] {
  const i = keys.indexOf(key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= keys.length) return keys;
  const next = [...keys];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ── on the phone (Add stock) ──

/**
 * The fields Add stock asks for, in order. A server from before field types sends only `spec_fields`
 * (pick-lists); the phone's kept copy of setup may be from then too.
 */
export function stockInFields(setup: Pick<ApiSetup, 'spec_fields'> & { fields?: ApiField[] } | null | undefined): ApiField[] {
  if (!setup) return [];
  // archived fields are there for old pallets' labels: not asked any more
  if (Array.isArray(setup.fields)) return setup.fields.filter((f) => !f.archived).sort((a, b) => a.sort - b.sort);
  return (setup.spec_fields ?? []).map((f, i) => ({ key: f.key, label: f.label, type: 'choice', required: false, options: f.options, sort: i }));
}

/** The fields this version of the app can ask for (audio and video are left out until the app records them). */
export const phoneFields = (fields: ApiField[]): ApiField[] => fields.filter((f) => PHONE_TYPES.includes(f.type));

/**
 * A number as typed ("12.5", "1,250", "-3"): the number, null for empty, or 'bad'. Indian grouping commas
 * are taken; a comma as the decimal point is not (1,5 is not 1.5).
 */
export function parseNumberInput(text: string): number | null | 'bad' {
  const value = text.trim().replace(/,(?=\d{2,3}(\D|$))/g, '');
  if (value === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(value)) return 'bad';
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= NUMBER_MAX ? n : 'bad';
}

/** What Add stock has for each field so far. */
export interface StockInAnswers {
  specs: Record<string, string | null>;
  /** text and number fields, as typed */
  typed: Record<string, string>;
  /** photo fields with a photo chosen */
  photos: Set<string>;
}

/** The stock-in's `details` (text and number fields): only those with a value. Bad numbers are left to fieldProblems. */
export function detailsOf(fields: ApiField[], typed: Record<string, string>): Record<string, string | number> | undefined {
  const details: Record<string, string | number> = {};
  for (const f of fields) {
    const raw = typed[f.key] ?? '';
    if (f.type === 'text') {
      const v = cleanLabel(raw);
      if (v) details[f.key] = v.slice(0, TEXT_MAX);
    } else if (f.type === 'number') {
      const n = parseNumberInput(raw);
      if (typeof n === 'number') details[f.key] = n;
    }
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

export type FieldProblem = 'required' | 'bad_number';

/** Each field Add stock cannot go ahead with: a required one left empty, or a number that is not one. */
export function fieldProblems(fields: ApiField[], answers: StockInAnswers): Record<string, FieldProblem> {
  const problems: Record<string, FieldProblem> = {};
  for (const f of fields) {
    if (f.type === 'number' && parseNumberInput(answers.typed[f.key] ?? '') === 'bad') {
      problems[f.key] = 'bad_number';
      continue;
    }
    if (!f.required) continue;
    const empty = f.type === 'choice'
      ? !answers.specs[f.key]
      : f.type === 'text' || f.type === 'number'
        ? !cleanLabel(answers.typed[f.key] ?? '')
        : f.type === 'photo'
          ? !answers.photos.has(f.key)
          : false;
    if (empty) problems[f.key] = 'required';
  }
  return problems;
}
