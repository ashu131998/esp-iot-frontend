import { describe, expect, it } from 'vitest';

import {
  SETUP_STEPS, boardProblems, buildSetupRequest, bulkMachines, emailList, emptySetupDraft, lineProblems, lookProblems,
  machineProblems, newBoard, newContact, newLine, newMachine, newWifi, newWorker, reportsProblems, setAdminEmail,
  setupStepsOk, stepOfSection, wifiProblems, workerProblems, type SetupDraft,
} from '@/lib/onboarding';
import { draftBody, draftProblems } from '@/lib/subscriptions';

/** A draft with just what is required: the factory and one admin. */
function minimal(): SetupDraft {
  const d = emptySetupDraft('2026-11-03');
  d.factory = { factory_id: 'shree-mills', name: 'Shree Mills', location: 'Surat', referred_by: '' };
  d.admins = [{ ...setAdminEmail(d.admins[0], 'owner@shree.in'), password: 'password1' }];
  return d;
}

describe('the steps', () => {
  it('in order, and server problems map to their step', () => {
    expect(SETUP_STEPS.map((s) => s.key)).toEqual(['factory', 'look', 'subscription', 'shifts', 'lines', 'wifi', 'boards', 'people', 'reports', 'review']);
    expect(stepOfSection('lines')).toBe(4);
    expect(stepOfSection('boards')).toBe(6);
    expect(stepOfSection('people')).toBe(7);
    expect(stepOfSection('unknown')).toBe(0);
  });

  it('only the factory and an admin are required: every other step is fine left empty', () => {
    const ok = setupStepsOk(minimal(), [], draftProblems);
    expect(ok.every(Boolean)).toBe(true);
    const empty = emptySetupDraft('2026-11-03');
    expect(setupStepsOk(empty, [], draftProblems)[0]).toBe(false);   // factory
    expect(setupStepsOk(empty, [], draftProblems)[7]).toBe(false);   // people: one admin needed
  });
});

describe('lines and machines', () => {
  it('a run of machines: names in order, skipping ones already there', () => {
    const line = newLine('line-1', 'Weaving');
    const made = bulkMachines({ prefix: 'Loom #', from: 1, to: 4, line_key: line.key, type: 'rapier', target_units_per_hour: '12' }, [newMachine(line.key, 'Loom #2')]);
    expect(made.map((m) => m.name)).toEqual(['Loom #1', 'Loom #3', 'Loom #4']);
    expect(made[0]).toMatchObject({ line_key: line.key, type: 'rapier', target_units_per_hour: '12' });
    expect(bulkMachines({ prefix: 'L', from: 5, to: 1, line_key: line.key })).toEqual([]);
  });

  it('line IDs valid and distinct; never "rescue"', () => {
    expect(lineProblems([newLine('line-1'), newLine('Line-1'), newLine('rescue'), newLine('a b')])).toEqual([
      {}, { line_id: 'Same ID as another line' }, { line_id: '"rescue" is kept for the rescue box' }, { line_id: 'Letters, digits, - and _ only' },
    ]);
  });

  it('machines: a name, a line, sensible numbers', () => {
    const line = newLine('line-1');
    const ok = newMachine(line.key, 'Loom #1');
    expect(machineProblems([ok, { ...newMachine('gone', 'Loom #1') }, { ...newMachine(line.key, 'X'), voltage_v: '0' }], [line])).toEqual([
      {}, { name: 'Same name as another machine', line_key: 'Pick a line' }, { numbers: 'Targets and voltage must be numbers above 0' },
    ]);
  });
});

describe('look, WiFi, workers, reports', () => {
  it('look: a real colour; a small PNG, JPEG or WebP', () => {
    expect(lookProblems({ accent_color: '#2563EB', logo: null, features: {} })).toEqual({});
    expect(lookProblems({ accent_color: 'blue', logo: { type: 'image/gif', data: '', name: 'x.gif', size: 10 }, features: {} }))
      .toEqual({ accent_color: 'A colour like #2563eb', logo: 'A PNG, JPEG or WebP image' });
    expect(lookProblems({ accent_color: '', logo: { type: 'image/png', data: '', name: 'x.png', size: 300_000 }, features: {} }).logo).toBe('At most 200 KB');
  });

  it('WiFi: a name of 1–32 bytes, a password of 8–63 or none (open), each network once', () => {
    expect(wifiProblems([{ ...newWifi(), ssid: 'Office', pass: 'secret123' }, { ...newWifi(), ssid: 'Floor', pass: '' }, { ...newWifi(), ssid: 'Office', pass: 'short' }]))
      .toEqual([{}, {}, { ssid: 'Listed twice', pass: '8–63 plain characters, or empty for an open network' }]);
    expect(wifiProblems([newWifi()])[0].ssid).toBe('The network name, 1–32 characters');
  });

  it('workers: a name; an app login needs an email and 8+ characters', () => {
    expect(workerProblems([{ ...newWorker(), name: 'Ravi' }])).toEqual([{}]);
    expect(workerProblems([{ ...newWorker(), name: '', password: 'password1', phone: 'abc' }]))
      .toEqual([{ name: 'Enter a name', password: 'An app login needs an email too', phone: 'Not a phone number' }]);
    expect(workerProblems([{ ...newWorker(), name: 'A', email: 'a@b.in', password: 'short' }])[0].password).toBe('At least 8 characters');
  });

  it('reports: emails, owners\' phones and amounts checked', () => {
    const r = emptySetupDraft('2026-11-03').reports;
    expect(reportsProblems({ ...r, emails: 'owner@shree.in, nope', owner_contacts: [{ ...newContact(), phone: '12' }], setup_fee: 'lots' })).toEqual({
      emails: 'Not an email: nope', contacts: 'Not a phone number: 12', money: 'Amounts must be numbers',
    });
    expect(emailList(' A@b.in, a@b.in\nc@d.in ;')).toEqual(['a@b.in', 'c@d.in']);
  });
});

describe('boards', () => {
  function withMachines() {
    const d = minimal();
    const line = newLine('line-1', 'Weaving A');
    d.lines = [line];
    d.machines = [newMachine(line.key, 'Loom #1'), newMachine(line.key, 'Loom #2')];
    return { d, line, loom1: d.machines[0].key, loom2: d.machines[1].key };
  }

  it('a board needs its line (a rescue box none); a machine may have several sensors of a kind', () => {
    const { d, line, loom1, loom2 } = withMachines();
    const ok = { ...newBoard('revb-311d80'), line_key: line.key, channels: { I1: loom1, P1: loom1, I2: loom2 } };
    expect(boardProblems([ok, newBoard('rescue-a1b2c3', true)], d.lines, d.machines)).toEqual([{}, {}]);
    expect(boardProblems([{ ...ok, line_key: '' }], d.lines, d.machines)[0].line_key).toBe('Pick its line');
    expect(boardProblems([{ ...ok, line_key: '' }], [], d.machines)[0].line_key).toBe('Add its line first, on Lines & machines');
    // Two motors on one machine, or two counting points: fine, on one board or across boards.
    expect(boardProblems([{ ...ok, channels: { I1: loom1, I3: loom1 } }], d.lines, d.machines)).toEqual([{}]);
    const other = { ...newBoard('revb-304ad0'), line_key: line.key, channels: { P2: loom1 } };
    expect(boardProblems([ok, other], d.lines, d.machines)).toEqual([{}, {}]);
    expect(boardProblems([{ ...ok, channels: { I4: 'removed-machine' } }], d.lines, d.machines)[0].channels).toBe('I4: its machine was removed; pick another');
    const steps = setupStepsOk({ ...d, boards: [{ ...ok, line_key: '' }] }, [], draftProblems);
    expect(steps[stepOfSection('boards')]).toBe(false);
  });

  it('to the API: machines by name, the line\'s ID, slots in order; a rescue box alone', () => {
    const { d, line, loom1, loom2 } = withMachines();
    d.boards = [
      { ...newBoard('revb-311d80'), line_key: line.key, channels: { I2: loom2, I1: loom1, P1: loom1 } },
      { ...newBoard('revb-304ad0'), line_key: line.key },
      { ...newBoard('rescue-a1b2c3', true), line_key: line.key },
    ];
    expect(buildSetupRequest(d, draftBody).boards).toEqual([
      {
        board_id: 'revb-311d80',
        line_id: 'line-1',
        channels: [{ slot: 'I1', machine: 'Loom #1' }, { slot: 'I2', machine: 'Loom #2' }, { slot: 'P1', machine: 'Loom #1' }],
      },
      { board_id: 'revb-304ad0', line_id: 'line-1' },
      { board_id: 'rescue-a1b2c3' },
    ]);
    expect(buildSetupRequest(minimal(), draftBody).boards).toBeUndefined();
  });
});

describe('buildSetupRequest: what goes to the API', () => {
  it('just the required parts (and the alert defaults) when nothing else was filled in', () => {
    const req = buildSetupRequest(minimal(), draftBody);
    expect(Object.keys(req).sort()).toEqual(['admins', 'alerts', 'factory', 'shifts']);
    expect(req.factory).toEqual({ factory_id: 'shree-mills', name: 'Shree Mills', location: 'Surat' });
    expect(req.alerts).toEqual({ mobile_enabled: true, notify_owner_on_down: true, owner_contacts: [] });
  });

  it('everything filled in, cleaned, machines on their lines\' IDs', () => {
    const d = minimal();
    const line = newLine('line-1', ' Weaving  A ');
    d.look = { accent_color: '#0D9488', logo: { type: 'image/png', data: 'iVBOR', name: 'logo.png', size: 5 }, features: { energy: false } };
    d.subscription = { ...d.subscription, enabled: true, ends_on: '2027-11-02', plan: 'Standard', machines: '40' };
    d.lines = [line];
    d.machines = [{ ...newMachine(line.key, 'Loom #1'), target_units_per_hour: '12', type: ' rapier ' }];
    d.wifi = [{ ...newWifi(), ssid: ' Office ', pass: 'secret123' }];
    d.workers = [{ ...newWorker(), name: 'Ravi', phone: '+91 98765 43210', email: 'Ravi@Shree.in', password: 'password2' }];
    d.reports = { ...d.reports, emails: 'owner@shree.in', value_per_loom_hour: '350', monthly_email: false, owner_contacts: [{ ...newContact(), name: 'Mr Shah', phone: '+919876543210' }] };
    const req = buildSetupRequest(d, draftBody);
    expect(req.look).toEqual({ accent_color: '#0d9488', logo: { type: 'image/png', data: 'iVBOR' }, features: { energy: false } });
    expect(req.subscription).toMatchObject({ starts_on: '2026-11-03', ends_on: '2027-11-02', plan: 'Standard', machines: 40 });
    expect(req.lines).toEqual([{ line_id: 'line-1', name: 'Weaving A' }]);
    expect(req.machines).toEqual([{ line_id: 'line-1', name: 'Loom #1', type: 'rapier', target_units_per_hour: 12 }]);
    expect(req.wifi).toEqual([{ ssid: 'Office', pass: 'secret123' }]);
    expect(req.workers).toEqual([{ name: 'Ravi', role: 'Machine Operator', phone: '+91 98765 43210', email: 'ravi@shree.in', password: 'password2' }]);
    expect(req.reports).toEqual({ enabled: true, recipient_emails: ['owner@shree.in'] });
    expect(req.alerts?.owner_contacts).toEqual([{ name: 'Mr Shah', phone: '+919876543210' }]);
    expect(req.results).toEqual({ monthly_email: false, value_per_loom_hour: 350 });
  });
});
