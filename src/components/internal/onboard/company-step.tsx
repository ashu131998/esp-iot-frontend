'use client';

import { useState } from 'react';

import { CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { MAX_COMPANY_NAME, companyProblems, type CompanyDraft, type CompanyOption } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

/**
 * The onboarding form's first step: the company the factory belongs to. A group with several
 * plants is one company: each new plant picks it here, a new customer gets a new one.
 */
export function CompanyStep({
  value, onChange, companies, loading = false, tried,
}: {
  value: CompanyDraft;
  onChange: (company: CompanyDraft) => void;
  companies: CompanyOption[];
  loading?: boolean;
  tried: boolean;
}) {
  const [query, setQuery] = useState('');
  const problem = companyProblems(value, companies).company;
  const q = query.trim().toLowerCase();
  const shown = q
    ? companies.filter((c) => c.name.toLowerCase().includes(q) || c.factories.some((f) => (f.name ?? f.factory_id).toLowerCase().includes(q)))
    : companies;
  const mode = (m: CompanyDraft['mode']) => onChange({ ...value, mode: m, ...(m === 'new' ? { company_id: '' } : {}) });
  const tab = (m: CompanyDraft['mode'], label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={value.mode === m}
      disabled={disabled}
      onClick={() => mode(m)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50',
        value.mode === m ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-slate-100',
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <CardHeader
        title="Company"
        description="The business this factory belongs to. A group with several plants is one company: pick it again for each new plant."
      />
      <div role="radiogroup" aria-label="Company" className="mb-4 inline-flex gap-1 rounded-lg border p-1">
        {tab('new', 'New company')}
        {tab('existing', loading ? 'Existing company' : `Existing company (${companies.length})`, !loading && companies.length === 0)}
      </div>

      {value.mode === 'new' ? (
        <Field label="Company name">
          <Input
            autoFocus
            value={value.name}
            maxLength={MAX_COMPANY_NAME}
            placeholder="Shree Ganesh Textiles Pvt. Ltd."
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
          {(tried || problem?.includes('already a company')) && problem && <p className="text-xs text-red-600">{problem}</p>}
          <p className="text-xs text-muted">Its legal or trading name. Each of its plants is set up as a factory under it, with its own address.</p>
        </Field>
      ) : (
        <div className="space-y-3">
          {companies.length > 6 && (
            <Input aria-label="Search companies" placeholder="Search by company or factory" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {loading && <p className="text-sm text-muted">Loading companies…</p>}
          <div role="radiogroup" aria-label="Companies" className="grid gap-2 sm:grid-cols-2">
            {shown.map((c) => {
              const picked = value.company_id === c.company_id;
              return (
                <button
                  key={c.company_id}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => onChange({ mode: 'existing', company_id: c.company_id, name: c.name })}
                  className={cn('rounded-lg border p-3 text-left hover:bg-slate-50', picked && 'border-primary ring-2 ring-primary/30')}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {c.factories.length === 0
                      ? 'No factories yet'
                      : `${c.factories.length} ${c.factories.length === 1 ? 'factory' : 'factories'}: ${c.factories.map((f) => f.name ?? f.factory_id).join(', ')}`}
                  </div>
                </button>
              );
            })}
          </div>
          {!loading && q && shown.length === 0 && <p className="text-sm text-muted">No company matches “{query.trim()}”.</p>}
          {tried && problem && <p className="text-xs text-red-600">{problem}</p>}
        </div>
      )}
    </>
  );
}
