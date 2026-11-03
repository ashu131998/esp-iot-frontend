'use client';

import { useQuery } from '@tanstack/react-query';

import { StatusBadge, StatusText } from '@/components/internal/board-status-cells';
import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import { firmware, isRescueBox, selfTest, type AdminBoard } from '@/lib/board-status';
import {
  SETUP_BOARD_SLOTS, boardProblems, newBoard, slotSensor, type BoardDraft, type LineDraft, type MachineDraft,
} from '@/lib/onboarding';

/** Where a new board reports until it is claimed (query-api boards.js). */
const UNCLAIMED = 'unclaimed';

const DESCRIPTION = 'Optional. Boards switched on at the factory show here while they wait to be claimed. Pick this factory\'s, each one\'s line, and which machine each sensor measures. They are claimed right after the factory is created, with their usual settings; the Boards page changes those later.';

function online(b: AdminBoard) {
  if (b.online === true) return { label: 'Online', tone: 'good' as const, detail: 'Connected to the server now' };
  return { label: 'Not connected', tone: 'neutral' as const, detail: 'Claimed anyway: it gets its settings when it next connects' };
}

/**
 * The boards waiting to be claimed (reporting as new), for this factory: each one's line and which
 * machine each of its sensors measures, set in the same go as the factory, then the boards claimed.
 * A super admin's: anyone else claims them later on the Boards page.
 */
export function BoardsStep({ value, lines, machines, onChange, tried, canClaim }: {
  value: BoardDraft[];
  lines: LineDraft[];
  machines: MachineDraft[];
  onChange: (next: BoardDraft[]) => void;
  tried: boolean;
  canClaim: boolean;
}) {
  const boardsQuery = useQuery({
    queryKey: ['admin-boards'],
    queryFn: ({ signal }) => api.adminBoards({ signal }),
    refetchInterval: 15_000,
    enabled: canClaim,
  });
  const waiting = (boardsQuery.data?.boards ?? []).filter((b) => b.factory_id === UNCLAIMED);
  const waitingIds = new Set(waiting.map((b) => b.board_id));
  const picked = new Set(value.map((b) => b.board_id));
  const problems = boardProblems(value, lines, machines);
  const named = machines.filter((m) => m.name.trim());
  const set = (k: string, patch: Partial<BoardDraft>) => onChange(value.map((b) => (b.key === k ? { ...b, ...patch } : b)));
  const pickMachine = (b: BoardDraft, slot: string, machineKey: string) => {
    const channels = { ...b.channels };
    if (machineKey) channels[slot] = machineKey;
    else delete channels[slot];
    // Its line: its first machine's, until one is picked.
    set(b.key, { channels, line_key: b.line_key || machines.find((m) => m.key === machineKey)?.line_key || '' });
  };

  if (!canClaim) {
    return (
      <>
        <CardHeader title="Boards" description={DESCRIPTION} />
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted">
          Only a super admin can claim boards. Skip this step: they are claimed later on the Boards page, and their sensors
          matched to machines on the factory&apos;s Sensor mapping page.
        </p>
        {value.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-600">
            {value.length} board{value.length === 1 ? '' : 's'} picked earlier on this device.
            <Button type="button" size="sm" variant="secondary" onClick={() => onChange([])}>Remove them</Button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <CardHeader title="Boards" description={DESCRIPTION} />

      {value.length > 0 && (
        <div className="mb-6 space-y-3">
          {value.map((b, i) => {
            const p = problems[i];
            const gone = boardsQuery.isSuccess && !waitingIds.has(b.board_id);
            return (
              <div key={b.key} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    <span className="font-mono">{b.board_id}</span>
                    {b.rescue && <span className="ml-2 text-xs font-normal text-muted">Rescue box</span>}
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((x) => x.key !== b.key))}>Remove</Button>
                </div>
                {gone && (
                  <p className="mb-2 text-xs text-amber-700">
                    Not waiting any more: claimed meanwhile, or no longer reporting as new. Remove it, or it is refused on Create.
                  </p>
                )}
                {b.rescue ? (
                  <p className="text-xs text-muted">
                    Goes to the factory alone: no line, no sensors. When the factory&apos;s WiFi changes before its boards know, they
                    take the new list from it.
                  </p>
                ) : (
                  <>
                    <div className="max-w-xs">
                      <Field label="Line">
                        <Select aria-label={`Line of ${b.board_id}`} value={b.line_key} onChange={(e) => set(b.key, { line_key: e.target.value })}>
                          <option value="">Pick a line</option>
                          {lines.map((l) => <option key={l.key} value={l.key}>{l.name.trim() || l.line_id.trim()}</option>)}
                        </Select>
                        {(tried || lines.length === 0) && p.line_key && <p className="text-xs text-red-600">{p.line_key}</p>}
                      </Field>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {SETUP_BOARD_SLOTS.map((slot) => (
                        <Field key={slot} label={`${slot} · ${slotSensor(slot) === 'current' ? 'current (CT)' : 'proximity'}`}>
                          <Select aria-label={`${b.board_id} ${slot}`} value={b.channels[slot] ?? ''} onChange={(e) => pickMachine(b, slot, e.target.value)}>
                            <option value="">Not used</option>
                            {lines.map((l) => {
                              const onLine = named.filter((m) => m.line_key === l.key);
                              return onLine.length === 0 ? null : (
                                <optgroup key={l.key} label={l.name.trim() || l.line_id.trim()}>
                                  {onLine.map((m) => <option key={m.key} value={m.key}>{m.name.trim()}</option>)}
                                </optgroup>
                              );
                            })}
                          </Select>
                        </Field>
                      ))}
                    </div>
                    {p.channels && <p className="mt-2 text-xs text-red-600">{p.channels}</p>}
                    <p className="mt-2 text-xs text-muted">
                      A machine may have several sensors: the first current sensor listed decides running or stopped, and proximity counts add up.
                    </p>
                    {named.length === 0 && <p className="mt-2 text-xs text-muted">Add machines on Lines &amp; machines to pick them here.</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Waiting to be claimed</h4>
        <Button type="button" size="sm" variant="ghost" disabled={boardsQuery.isFetching} onClick={() => boardsQuery.refetch()}>
          {boardsQuery.isFetching ? 'Looking…' : 'Refresh'}
        </Button>
      </div>
      {boardsQuery.data && boardsQuery.data.broker !== 'ok' && (
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          The MQTT broker cannot be reached from the server right now, so a claim would fail. Leave the boards out and claim them later
          on the Boards page.
        </p>
      )}
      {boardsQuery.isPending && <p className="mt-2 text-sm text-muted">Looking for boards…</p>}
      {boardsQuery.error && <p className="mt-2 text-sm text-red-600">{(boardsQuery.error as Error).message}</p>}
      {boardsQuery.isSuccess && waiting.length === 0 && (
        <p className="mt-2 text-sm text-muted">None waiting. A new board shows here a few seconds after it is switched on and online.</p>
      )}
      {waiting.length > 0 && (
        <ul className="mt-2 divide-y rounded-lg border text-sm">
          {waiting.map((w) => {
            const box = isRescueBox(w);
            return (
              <li key={w.board_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono">{w.board_id}</span>
                  {box && <span className="text-xs text-muted">Rescue box</span>}
                  <StatusBadge cell={online(w)} />
                  <span className="text-xs text-muted">fw {firmware(w.beat)}</span>
                  {!box && <span className="text-xs text-muted">Self-test <StatusText cell={selfTest(w.beat)} /></span>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={picked.has(w.board_id)}
                  onClick={() => onChange([...value, newBoard(w.board_id, box)])}
                >
                  {picked.has(w.board_id) ? 'Added' : 'Add'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
