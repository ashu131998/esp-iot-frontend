'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { ImsApiError, imsItemsApi, isImsOff } from '@/lib/ims/api';
import {
  draftOf, draftProblem, editFieldBody, emptyDraft, FIELD_TYPE_LABELS, FIELD_TYPES, fieldHelp, isMediaType, ITEM_NAME_MAX, MAX_FIELDS, moveKey, newFieldBody,
  PHONE_TYPES, TYPE_HELP, UNITS,
  type ApiField, type ApiItem, type ApiItemList, type FieldDraft, type FieldType,
} from '@/lib/ims/fields';
import { cn } from '@/lib/utils';

/** Why a write was refused, in the server's words (with how much stock is in the way, when it says). */
function refusal(error: unknown): string {
  if (!(error instanceof ImsApiError)) return 'Could not reach FloorBeat. Try again.';
  const pallets = (error.body as { pallets?: number } | undefined)?.pallets;
  return pallets ? `${error.message} (${pallets} ${pallets === 1 ? 'entry' : 'entries'} in stock)` : error.message;
}

/**
 * One factory's stock items (ops.floorbeat.in → Stock items): the kinds of stock it keeps, and for each, what
 * adding it on the phone asks for, in order. First the item's name, then its fields (Ashutosh, 2026-11-27: "on
 * super admin dashboard, first item name, then its field, we dont have single item in a factory"). Our staff add
 * and change them; factory admins cannot (query-api ims-routes.js). A removed field is only hidden: old records
 * keep what they were saved with.
 */
export function StockItemsPanel({ factoryId }: { factoryId: string }) {
  const qc = useQueryClient();
  const queryKey = ['ims-items', factoryId];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => imsItemsApi.list(factoryId, signal),
    retry: (n, error) => !(error instanceof ImsApiError && error.status < 500) && n < 2,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const [itemSheet, setItemSheet] = useState<ApiItem | 'new' | null>(null);

  // the answer goes into the cache as it is: asking again could read a replica that has not caught up
  const put = (update: (prev: ApiItemList) => ApiItemList) =>
    qc.setQueryData<ApiItemList>(queryKey, (prev) => (prev ? update(prev) : prev));
  const putItem = (productId: string, update: (item: ApiItem) => ApiItem) =>
    put((prev) => ({ items: prev.items.map((it) => (it.product_id === productId ? update(it) : it)) }));

  if (list.isPending) return <TableSkeleton rows={4} cols={3} />;
  if (list.error) {
    return (
      <Card>
        <p className="text-sm text-red-700">
          {isImsOff(list.error)
            ? 'The IMS is not switched on for this factory. Switch it on in Pages & branding first.'
            : `Could not load the items: ${refusal(list.error)}`}
        </p>
      </Card>
    );
  }

  const { items } = list.data;
  const item = items.find((it) => it.product_id === chosen) ?? items[0] ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Items"
          description="The kinds of stock this factory keeps. Each has its own fields: pick one to set what adding it asks for."
          action={(
            <Button onClick={() => setItemSheet('new')}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />Add item
            </Button>
          )}
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted">No items yet. Add the first one: its name, then its fields.</p>
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Items">
            {items.map((it) => {
              const on = item?.product_id === it.product_id;
              return (
                <li key={it.product_id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setChosen(it.product_id)}
                    aria-current={on ? 'true' : undefined}
                    className={cn('min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left', on ? 'bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-slate-50')}
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {it.name}
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{it.unit}</span>
                      {it.sku && <span className="text-xs text-muted">SKU {it.sku}</span>}
                      {!it.active && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">Not in use</span>}
                    </span>
                    <span className="block text-sm text-muted">
                      {it.fields.length === 0 ? 'No fields yet: the phone asks only the quantity' : `${it.fields.length} ${it.fields.length === 1 ? 'field' : 'fields'}: ${it.fields.map((f) => f.label).join(', ')}`}
                    </span>
                  </button>
                  <Button variant="secondary" size="sm" onClick={() => setItemSheet(it)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {item && (
        <ItemFields
          key={item.product_id}
          factoryId={factoryId}
          item={item}
          onChange={(update) => putItem(item.product_id, update)}
        />
      )}

      {itemSheet && (
        <ItemSheet
          factoryId={factoryId}
          item={itemSheet === 'new' ? null : itemSheet}
          onClose={() => setItemSheet(null)}
          onSaved={(saved) => {
            put((prev) => (prev.items.some((it) => it.product_id === saved.product_id)
              ? { items: prev.items.map((it) => (it.product_id === saved.product_id ? { ...it, ...saved, removed: it.removed } : it)) }
              : { items: [...prev.items, { ...saved, removed: [] }].sort((a, b) => a.name.localeCompare(b.name)) }));
            setChosen(saved.product_id);
            setItemSheet(null);
          }}
        />
      )}
    </div>
  );
}

/** An item's name, unit, SKU (only if the factory uses them) and whether it is still added. */
function ItemSheet({ factoryId, item, onClose, onSaved }: {
  factoryId: string;
  item: ApiItem | null;
  onClose: () => void;
  onSaved: (item: Omit<ApiItem, 'removed'>) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'pcs');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [shown, setShown] = useState(false);
  const cleanName = name.replace(/\s+/g, ' ').trim();
  const problem = !cleanName ? 'Give the item a name.' : cleanName.length > ITEM_NAME_MAX ? `At most ${ITEM_NAME_MAX} characters.` : null;
  const save = useMutation({
    mutationFn: () => {
      const body = { name: cleanName, unit, sku: sku.trim() || null };
      return item ? imsItemsApi.update(factoryId, item.product_id, { ...body, active }) : imsItemsApi.create(factoryId, body);
    },
    onSuccess: onSaved,
  });
  return (
    <Sheet title={item ? `Edit ${item.name}` : 'Add an item'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setShown(true);
          if (!problem) save.mutate();
        }}
      >
        <div>
          <Label htmlFor="si-name">Name, as the phone shows it</Label>
          <Input id="si-name" value={name} maxLength={ITEM_NAME_MAX} autoFocus placeholder="Fabric roll, Yarn cone, Bedsheet set" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="si-unit">Counted in</Label>
          <Select id="si-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <p className="mt-1 text-xs text-muted">What its quantity is. It cannot change while the item has stock.</p>
        </div>
        <div>
          <Label htmlFor="si-sku">SKU (optional)</Label>
          <Input id="si-sku" value={sku} maxLength={40} placeholder="Only if the factory uses codes for its items" onChange={(e) => setSku(e.target.value)} />
        </div>
        {item && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              <span className="font-medium text-foreground">In use</span>
              <span className="block text-muted">Off: the phone stops offering it. Its stock stays.</span>
            </span>
          </label>
        )}
        {shown && problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}
        {save.error && <p role="alert" className="text-sm text-red-700">{refusal(save.error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : item ? 'Save' : 'Add item'}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** One item's fields: what adding it asks for, in order, and the ones removed. */
function ItemFields({ factoryId, item, onChange }: {
  factoryId: string;
  item: ApiItem;
  onChange: (update: (item: ApiItem) => ApiItem) => void;
}) {
  const [editing, setEditing] = useState<ApiField | 'new' | null>(null);
  const [removing, setRemoving] = useState<ApiField | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const order = useMutation({
    mutationFn: (keys: string[]) => imsItemsApi.orderFields(factoryId, item.product_id, keys),
    onMutate: () => setOrderError(null),
    onSuccess: (res) => onChange((it) => ({ ...it, fields: res.fields })),
    onError: (error) => setOrderError(refusal(error)),
  });

  const { fields, removed } = item;
  const keys = fields.map((f) => f.key);
  const takenKeys = [...keys, ...removed.map((f) => f.key)];
  const full = fields.length >= MAX_FIELDS;

  return (
    <>
      <Card>
        <CardHeader
          title={`Adding ${item.name} asks for`}
          description="In this order, on the phone, after the quantity. Phones pick up a change the next time Add item is opened. Old records keep what they were saved with."
          action={(
            <Button onClick={() => setEditing('new')} disabled={full} title={full ? `At most ${MAX_FIELDS} fields` : undefined}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />Add field
            </Button>
          )}
        />
        {fields.length === 0 ? (
          <p className="text-sm text-muted">No fields yet. Adding {item.name} asks only for the quantity.</p>
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
                  <p className="mt-0.5 truncate text-sm text-muted">{fieldHelp(f)}</p>
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
          <CardHeader title={`Removed fields of ${item.name}`} description="No longer asked. Records saved with them keep their values." />
          <ul className="space-y-1 text-sm text-muted">
            {removed.map((f) => <li key={f.key}>{f.label} · {FIELD_TYPE_LABELS[f.type]}</li>)}
          </ul>
        </Card>
      )}

      {editing && (
        <FieldSheet
          factoryId={factoryId}
          item={item}
          field={editing === 'new' ? null : editing}
          takenKeys={takenKeys}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            onChange((it) => ({
              ...it,
              fields: it.fields.some((f) => f.key === saved.key) ? it.fields.map((f) => (f.key === saved.key ? saved : f)) : [...it.fields, saved],
            }));
            setEditing(null);
          }}
        />
      )}

      {removing && (
        <RemoveSheet
          factoryId={factoryId}
          item={item}
          field={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            onChange((it) => ({ ...it, fields: it.fields.filter((f) => f.key !== removing.key), removed: [...it.removed, removing] }));
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}

function FieldSheet({ factoryId, item, field, takenKeys, onClose, onSaved }: {
  factoryId: string;
  item: ApiItem;
  field: ApiField | null;
  takenKeys: string[];
  onClose: () => void;
  onSaved: (field: ApiField) => void;
}) {
  const [draft, setDraft] = useState<FieldDraft>(() => (field ? draftOf(field) : emptyDraft()));
  const [shown, setShown] = useState(false);
  const save = useMutation({
    mutationFn: () => (field
      ? imsItemsApi.updateField(factoryId, item.product_id, field.key, editFieldBody(draft))
      : imsItemsApi.createField(factoryId, item.product_id, newFieldBody(draft, takenKeys))),
    onSuccess: onSaved,
  });
  const problem = draftProblem(draft);
  const set = (patch: Partial<FieldDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setChoice = (i: number, label: string) =>
    set({ choices: draft.choices.map((c, j) => (j === i ? { ...c, label } : c)) });

  return (
    <Sheet title={field ? `Edit ${field.label}` : `Add a field to ${item.name}`} onClose={onClose}>
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
            {field && <p className="text-xs text-muted">A choice that stock of {item.name} still has cannot be taken away.</p>}
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
        {save.error && <p role="alert" className="text-sm text-red-700">{refusal(save.error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : field ? 'Save' : 'Add field'}</Button>
        </div>
      </form>
    </Sheet>
  );
}

function RemoveSheet({ factoryId, item, field, onClose, onRemoved }: {
  factoryId: string;
  item: ApiItem;
  field: ApiField;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const remove = useMutation({ mutationFn: () => imsItemsApi.removeField(factoryId, item.product_id, field.key), onSuccess: onRemoved });
  return (
    <Sheet title={`Remove ${field.label}?`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>Adding {item.name} stops asking for it. Records saved with it keep their value{isMediaType(field.type) ? 's and files' : ''}.</p>
        <p className="text-muted">This cannot be undone. You can add a new field with the same name later; old records keep the old one.</p>
        {remove.error && <p role="alert" className="text-red-700">{refusal(remove.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove'}</Button>
        </div>
      </div>
    </Sheet>
  );
}
