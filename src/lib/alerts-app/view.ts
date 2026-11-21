/**
 * An alert in the person's language. The engine writes every alert in English (title, message)
 * and, since 2026-11-17, the facts behind it in payload.view — the kind of alert, the machine,
 * when, how long it was down, the shift — so the app can say it in Hindi or Gujarati. An older
 * alert without them shows its English text. Pure: tested in lib/__tests__/alerts-app-view.test.ts.
 */
import { formatTime } from '@/lib/format';
import type { Translator } from '@/lib/i18n/translate';

import { asksQuestion, titleOf } from './model';
import type { MyAlert } from './types';

export interface AlertFacts {
  kind?: string;
  machine?: string | null;
  line?: string | null;
  at?: string | null;
  down_for_min?: number | null;
  /** How long the machine had been stopped, with no reason given, when the alert went up. */
  waiting_min?: number | null;
  shift?: string | null;
  start?: string | null;
  task?: string | null;
  machines?: string[] | null;
  profile?: string | null;
  operators?: string[] | null;
  /** A camera's id: something in front of it (camera_blocked), a truck or a hand its models saw (camera_truck / _hand). */
  camera?: string | null;
}

export interface AlertWords {
  title: string;
  /** The alert in the person's language; null when only the English message is there. */
  body: string | null;
}

/** The facts the engine attached, when it did. */
export function factsOf(alert: Pick<MyAlert, 'payload'>): AlertFacts | null {
  const view = alert.payload?.view;
  return view && typeof view === 'object' && typeof (view as AlertFacts).kind === 'string' ? (view as AlertFacts) : null;
}

/** "12 m", "1 h 05 m" in the person's language, from the common duration words. */
export function durationWords(minutes: number, t: Translator['t']): string {
  const total = Math.max(1, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return t('{h} h {m} m', { h, m });
  if (h > 0) return t('{h} h', { h });
  return t('{m} m', { m });
}

/** A downtime reason the engine offers, in the person's language; anything else as written. */
export function reasonWords(label: string, t: Translator['t']): string {
  switch (label) {
    case 'Yarn breakage': return t('Yarn breakage');
    case 'Mechanical fault': return t('Mechanical fault');
    case 'Power / electrical': return t('Power / electrical');
    case 'Maintenance': return t('Maintenance');
    case 'Material shortage': return t('Material shortage');
    case 'Operator break': return t('Operator break');
    case 'Quality stop': return t('Quality stop');
    case 'Other': return t('Other');
    default: return label;
  }
}

/** The alert's title and body in the person's language, or its English title alone. */
export function alertWords(alert: MyAlert, tr: Translator): AlertWords {
  const { t, locale } = tr;
  const facts = factsOf(alert);
  if (!facts) return { title: titleOf(alert), body: null };
  const machine = facts.machine || alert.machine_name || t('Machine');
  const time = facts.at ? formatTime(facts.at, locale) : null;
  const asks = asksQuestion(alert);
  switch (facts.kind) {
    case 'machine_down': {
      const lines = [time ? t('{machine} stopped at {time}.', { machine, time }) : t('{machine} stopped.', { machine })];
      if (asks) lines.push(t('Why is it down? Tap an answer below.'));
      return { title: t('{machine} stopped', { machine }), body: lines.join('\n') };
    }
    case 'machine_up': {
      const after = facts.down_for_min ? t(' after {duration}', { duration: durationWords(facts.down_for_min, t) }) : '';
      const lines = [time ? t('{machine} came back at {time}{after}.', { machine, time, after }) : t('{machine} is running again.', { machine })];
      if (asks) lines.push(alert.payload?.kind === 'fix_confirmation' ? t('Did you get it running? Tap below.') : t('Which configuration is it running? Tap one below.'));
      return { title: t('{machine} is running again', { machine }), body: lines.join('\n') };
    }
    case 'shift_reminder': {
      const shift = facts.shift || t('Shift');
      const start = facts.start ? formatTime(facts.start, locale) : null;
      const lines: string[] = [];
      if (facts.task) lines.push(t('Task: {task}', { task: facts.task }));
      if (facts.machines?.length) lines.push(t('Machines: {machines}', { machines: facts.machines.join(', ') }));
      if (facts.profile) lines.push(t('Configuration: {profile}', { profile: facts.profile }));
      return {
        title: start ? t('{shift} starts at {time}', { shift, time: start }) : t('{shift} starts soon', { shift }),
        body: lines.length ? lines.join('\n') : null,
      };
    }
    case 'owner_down': {
      const lines = [time ? t('{machine} stopped at {time}.', { machine, time }) : t('{machine} stopped.', { machine })];
      const names = (facts.operators ?? []).filter(Boolean);
      lines.push(names.length ? t('{names} has been asked for the reason in the app.', { names: names.join(', ') }) : t('No operator is assigned to this machine right now.'));
      return { title: t('{machine} stopped', { machine }), body: lines.join('\n') };
    }
    case 'owner_up': {
      const after = facts.down_for_min ? t(' after {duration}', { duration: durationWords(facts.down_for_min, t) }) : '';
      return {
        title: t('{machine} is running again', { machine }),
        body: time ? t('{machine} came back at {time}{after}.', { machine, time, after }) : t('{machine} is running again.', { machine }),
      };
    }
    // Nobody answered: the supervisor gets the question, the owner is told.
    case 'machine_down_waiting':
    case 'owner_unanswered': {
      const lines = [facts.waiting_min
        ? t('{machine} has been stopped for {duration}. Nobody has said why yet.', { machine, duration: durationWords(facts.waiting_min, t) })
        : t('{machine} is still stopped. Nobody has said why yet.', { machine })];
      if (asks) lines.push(t('Why is it down? Tap an answer below.'));
      return { title: t('{machine} is still stopped', { machine }), body: lines.join('\n') };
    }
    // Something in front of a camera (firmware 2.9.6): a hand on the lens, a cover.
    case 'camera_blocked': {
      const camera = facts.camera || t('A camera');
      const where = facts.machine ? t('{camera} at {machine}', { camera, machine: facts.machine }) : camera;
      return {
        title: t('Something is in front of {camera}', { camera: where }),
        body: time
          ? t('Since {time}: a hand on the lens, a cover, or something big right in front of it. Watch it live on the Cameras page.', { time })
          : t('A hand on the lens, a cover, or something big right in front of it. Watch it live on the Cameras page.'),
      };
    }
    // What the AI models saw in a camera's picture (firmware 2.9.8): a truck at the gate, a hand in front of it.
    case 'camera_truck':
    case 'camera_hand': {
      const camera = facts.camera || t('A camera');
      const where = facts.machine ? t('{camera} at {machine}', { camera, machine: facts.machine }) : camera;
      return {
        title: facts.kind === 'camera_truck' ? t('A truck at {camera}', { camera: where }) : t('A hand in front of {camera}', { camera: where }),
        body: time
          ? t('Seen at {time}. Its picture and live view are on the Cameras page.', { time })
          : t('Its picture and live view are on the Cameras page.'),
      };
    }
    default:
      return { title: titleOf(alert), body: null };
  }
}
