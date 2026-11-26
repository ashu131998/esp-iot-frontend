'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { ImsApiError, imsFieldsApi, isImsOff } from '@/lib/ims/api';
import {
  draftOf, draftProblem, editFieldBody, emptyDraft, FIELD_TYPE_LABELS, FIELD_TYPES, fieldHelp, isMediaType, MAX_FIELDS, moveKey, newFieldBody,
  PHONE_TYPES, TYPE_HELP,
  type ApiField, type ApiFieldList, type FieldDraft, type FieldType,
} from '@/lib/ims/fields';

/** Why a write was refused, with the products in the way when the server lists them (a pick-list in use). */
function refusal(error: unknown): string {
  if (!(error instanceof ImsApiError)) return 'Could not reach FloorBeat. Try again.';
  return error.message;
}

/**
 * One factory's Stock details (ops.floorbeat.in → Stock details): the details Add stock asks for in the IMS
 * app, in order. Our staff add, edit, reorder and remove them; factory admins cannot (query-api ims-routes.js,
 * Ashutosh 2026-11-26). A removed field is only hidden: old pallets keep what they were saved with.
 */
export function StockDetailsPanel({ factoryId }: { factoryId: string }) {
  const qc = useQueryClient();
  const queryKey = ['ims-spec-fields', factoryId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => imsFieldsApi.list(factoryId, signal),
    retry: (n, error) => !(error instanceof ImsApiError && error.status < 500) && n < 2,
  });
  const [editing, setEditing] = useState<ApiField | 'new' | null>(null);
  const [removing, setRemoving] = useState<ApiField | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // the answer goes into the cache as it is: asking again could read a replica that has not caught up
  const put = (update: (prev: ApiFieldList) => ApiFieldList) =>
    qc.setQueryData<ApiFieldList>(queryKey, (prev) => (prev ? update(prev) : prev));

  const order = useMutation({
    mutationFn: (keys: string[]) => imsFieldsApi.order(factoryId, keys),
    onMutate: () => setOrderError(null),
    onSuccess: (res) => put((prev) => ({ ...prev, fields: res.fields })),
    onError: (error) => setOrderError(refusal(error)),
  });

  if (list.isPending) return <TableSkeleton rows={4} cols={3} />;
  if (list.error) {
    return (
      <Card>
        <p className="text-sm text-red-700">
          {isImsOff(list.error)
            ? 'The IMS is not switched on for this factory. Switch it on in Pages & branding first.'
            : `Could not load the fields: ${refusal(list.error)}`}
        </p>
      </Card>
    );
  }

  const { fields, removed } = list.data;
  const keys = fields.map((f) => f.key);
  const takenKeys = [...keys, ...removed.map((f) => f.key)];
  const full = fields.length >= MAX_FIELDS;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Add stock asks for"
          description="In this order, on the phone, after the quantity. Phones pick up a change the next time Stock in is opened. Old pallets keep what they were saved with."
          action={(
            <Button onClick={() => setEditing('new')} disabled={full} title={full ? `At most ${MAX_FIELDS} fields` : undefined}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />Add field
            </Button>
          )}
        />
        {fields.length === 0 ? (
          <p className="text-sm text-muted">No fields yet. Add stock asks only for the product, location and quantity.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {fields.map((f, i) => (
              <li key={f.key} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {f.label}
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{FIELD_TYPE_LABELS[f.type]}</span>
                    {f.required
                      ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Required</span>
                      : <span className="text-xs text-muted">Optional</span>}
                    {f.type === 'number' && f.unit && <span className="text-xs text-muted">in {f.unit}</span>}
                    {isMediaType(f.type) && f.allow_library === false && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">Taken now only</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {fieldHelp(f)}
                  </p>
                  {!PHONE_TYPES.includes(f.type) && (
                    <p className="mt-0.5 text-xs text-amber-700">The phone app asks for {FIELD_TYPE_LABELS[f.type].toLowerCase()} in its next version.</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" aria-label={`Move ${f.label} up`} disabled={i === 0 || order.isPending} onClick={() => order.mutate(moveKey(keys, f.key, -1))}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Move ${f.label} down`} disabled={i === fields.length - 1 || order.isPending} onClick={() => order.mutate(moveKey(keys, f.key, 1))}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(f)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />Edit
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Remove ${f.label}`} onClick={() => setRemoving(f)}>
                    <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {orderError && <p role="alert" className="mt-2 text-sm text-red-700">Could not change the order: {orderError}</p>}
      </Card>

      {removed.length > 0 && (
        <Card>
          <CardHeader title="Removed fields" description="No longer asked. Pallets saved with them keep their values." />
          <ul className="space-y-1 text-sm text-muted">
            {removed.map((f) => <li key={f.key}>{f.label} · {FIELD_TYPE_LABELS[f.type]}</li>)}
          </ul>
        </Card>
      )}

      {editing && (
        <FieldSheet
          factoryId={factoryId}
          field={editing === 'new' ? null : editing}
          takenKeys={takenKeys}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            put((prev) => ({
              ...prev,
              fields: prev.fields.some((f) => f.key === saved.key)
                ? prev.fields.map((f) => (f.key === saved.key ? saved : f))
                : [...prev.fields, saved],
            }));
            setEditing(null);
          }}
        />
      )}

      {removing && (
        <RemoveSheet
          factoryId={factoryId}
          field={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            put((prev) => ({
              fields: prev.fields.filter((f) => f.key !== removing.key),
              removed: [...prev.removed, removing],
            }));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function FieldSheet({ factoryId, field, takenKeys, onClose, onSaved }: {
  factoryId: string;
  field: ApiField | null;
  takenKeys: string[];
  onClose: () => void;
  onSaved: (field: ApiField) => void;
}) {
  const [draft, setDraft] = useState<FieldDraft>(() => (field ? draftOf(field) : emptyDraft()));
  const [shown, setShown] = useState(false);
  const save = useMutation({
    mutationFn: () => (field
      ? imsFieldsApi.update(factoryId, field.key, editFieldBody(draft))
      : imsFieldsApi.create(factoryId, newFieldBody(draft, takenKeys))),
    onSuccess: onSaved,
  });
  const problem = draftProblem(draft);
  const set = (patch: Partial<FieldDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setChoice = (i: number, label: string) =>
    set({ choices: draft.choices.map((c, j) => (j === i ? { ...c, label } : c)) });

  return (
    <Sheet title={field ? `Edit ${field.label}` : 'Add a field'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setShown(true);
          if (!problem) save.mutate();
        }}
      >
        <div>
          <Label htmlFor="sd-label">Name, as the phone shows it</Label>
          <Input id="sd-label" value={draft.label} maxLength={40} autoFocus placeholder="Grade, Weight (kg), Photo of the label" onChange={(e) => set({ label: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="sd-type">Type</Label>
          <Select id="sd-type" value={draft.type} disabled={Boolean(field)} onChange={(e) => set({ type: e.target.value as FieldType })}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {field ? 'A field\'s type cannot change. Remove it and add a new one instead.' : TYPE_HELP[draft.type]}
          </p>
        </div>
        {draft.type === 'choice' && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Choices</legend>
            {draft.choices.map((c, i) => (
              <div key={c.value ?? `new-${i}`} className="flex items-center gap-2">
                <Input aria-label={`Choice ${i + 1}`} value={c.label} maxLength={40} onChange={(e) => setChoice(i, e.target.value)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove choice ${c.label || i + 1}`}
                  disabled={draft.choices.length === 1}
                  onClick={() => set({ choices: draft.choices.filter((_, j) => j !== i) })}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => set({ choices: [...draft.choices, { value: null, label: '' }] })}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />Add choice
            </Button>
            {field && <p className="text-xs text-muted">A choice that products or pallets in stock still have cannot be taken away.</p>}
          </fieldset>
        )}
        {draft.type === 'number' && (
          <div>
            <Label htmlFor="sd-unit">Unit (optional)</Label>
            <Input id="sd-unit" value={draft.unit} maxLength={12} placeholder="kg, m, mm" onChange={(e) => set({ unit: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Shown next to the number on the phone.</p>
          </div>
        )}
        {isMediaType(draft.type) && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={draft.allowLibrary} onChange={(e) => set({ allowLibrary: e.target.checked })} />
            <span>
              <span className="font-medium text-foreground">Allow choosing from the phone</span>
              <span className="block text-muted">Off: the {FIELD_TYPE_LABELS[draft.type].toLowerCase()} must be taken on the spot, as proof the stock is in front of the person.</span>
            </span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={draft.required} onChange={(e) => set({ required: e.target.checked })} />
          <span>
            <span className="font-medium text-foreground">Required</span>
            <span className="block text-muted">The phone does not add the stock until this is filled in.</span>
          </span>
        </label>
        {shown && problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
        {save.error && <p role="alert" className="text-sm text-red-700">{refusalWithProducts(save.error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : field ? 'Save' : 'Add field'}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** A refusal and, for a pick-list still in use, the products that have it (the server's 409 lists them). */
function refusalWithProducts(error: unknown): string {
  const text = refusal(error);
  if (!(error instanceof ImsApiError) || error.status !== 409) return text;
  const body = error.body as { products?: Array<{ name: string }>; pallets?: number } | undefined;
  const names = body?.products?.map((p) => p.name).slice(0, 5) ?? [];
  const pallets = body?.pallets ?? 0;
  const parts = [names.length ? `Products: ${names.join(', ')}` : '', pallets ? `${pallets} pallets in stock` : ''].filter(Boolean);
  return parts.length ? `${text} (${parts.join('; ')})` : text;
}

function RemoveSheet({ factoryId, field, onClose, onRemoved }: {
  factoryId: string;
  field: ApiField;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const remove = useMutation({ mutationFn: () => imsFieldsApi.remove(factoryId, field.key), onSuccess: onRemoved });
  return (
    <Sheet title={`Remove ${field.label}?`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>Add stock stops asking for it. Pallets saved with it keep their value{field.type === 'photo' || field.type === 'audio' || field.type === 'video' ? 's and files' : ''}.</p>
        <p className="text-muted">This cannot be undone. You can add a new field with the same name later; old pallets keep the old one.</p>
        {remove.error && <p role="alert" className="text-red-700">{refusalWithProducts(remove.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove'}</Button>
        </div>
      </div>
    </Sheet>
  );
}
