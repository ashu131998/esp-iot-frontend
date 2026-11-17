'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api';

const NEW = '__new__';
type Company = { company_id: string; name: string };

/**
 * The company a factory belongs to (staff only): factories onboarded before companies have none,
 * and a group's plants can be brought together here. Its admins become the company's: one
 * account for every plant of it. A username already in that company stops the move (409).
 */
export function CompanyCard({ factoryId, initial }: { factoryId: string; initial: Company | null }) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<Company | null>(initial);
  const [choice, setChoice] = useState<string>(initial?.company_id ?? '');
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const companies = useQuery({ queryKey: ['admin-companies'], queryFn: ({ signal }) => api.adminCompanies({ signal }) });
  const list = companies.data?.companies ?? [];

  const save = useMutation({
    mutationFn: () => api.adminSetFactoryCompany(factoryId, choice === NEW ? { name: newName.trim() } : { company_id: choice || null }),
    onSuccess: (res) => {
      setCurrent(res.company);
      setChoice(res.company?.company_id ?? '');
      setNewName('');
      setNote(res.company
        ? `Now a factory of ${res.company.name}.${res.admins.length > 0 ? ` Its admin${res.admins.length === 1 ? '' : 's'} (${res.admins.join(', ')}) now sign in at every factory of the company.` : ''}`
        : `No longer under a company.${res.admins.length > 0 ? ` Its admin${res.admins.length === 1 ? '' : 's'} (${res.admins.join(', ')}) sign in here only.` : ''}`);
      void qc.invalidateQueries({ queryKey: ['admin-companies'] });
      void qc.invalidateQueries({ queryKey: ['admin-factories'] });
    },
    onError: () => setNote(null),
  });
  const dirty = choice === NEW ? newName.trim().length > 0 : choice !== (current?.company_id ?? '');
  const error = save.error ? (save.error as ApiError).message : null;

  return (
    <Card>
      <CardHeader
        title="Company"
        description="The business this factory belongs to. A group's plants share one company: its admins sign in at every one of them."
      />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save.mutate();
        }}
      >
        <Field label="Company">
          <Select value={choice} onChange={(e) => { setChoice(e.target.value); setNote(null); }} disabled={companies.isLoading}>
            <option value="">None (this factory on its own)</option>
            {list.map((c) => (
              <option key={c.company_id} value={c.company_id}>
                {c.name}{c.factories.length > 0 ? ` (${c.factories.length} ${c.factories.length === 1 ? 'factory' : 'factories'})` : ''}
              </option>
            ))}
            <option value={NEW}>New company…</option>
          </Select>
        </Field>
        {choice === NEW && (
          <Field label="Company name">
            <Input autoFocus value={newName} maxLength={120} placeholder="Shree Ganesh Textiles Pvt. Ltd." onChange={(e) => setNewName(e.target.value)} />
          </Field>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          {current && !dirty && <span className="text-sm text-muted">A factory of <span className="font-medium text-foreground">{current.name}</span></span>}
        </div>
      </form>
      {note && <p className="mt-3 text-sm text-emerald-700">{note}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
