'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/auth-types';
import { useT } from '@/lib/i18n/context';
import { generatePassword } from '@/lib/onboarding';

type Role = 'admin' | 'employee';
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The sign-in details of a new account, to hand over when no welcome email went. */
function SignInDetails({ factoryId, username, password }: { factoryId: string; username: string; password: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const text = [`${t('Factory')}: ${factoryId}`, `${t('Username')}: ${username}`, `${t('Password')}: ${password}`].join('\n');
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
      <p className="mb-2 font-medium">{t('Sign-in details')}</p>
      <pre className="whitespace-pre-wrap font-mono text-xs">{text}</pre>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? t('Copied') : t('Copy')}
      </Button>
    </div>
  );
}

/** The form behind "Add person": a username, an optional email, the role and a password. */
export function AddPersonForm({ factoryId, onDone }: { factoryId: string; onDone: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [password, setPassword] = useState(() => generatePassword());
  const [shown, setShown] = useState(true);
  const create = useMutation({
    mutationFn: () => api.factoryCreateUser(factoryId, { username: username.trim(), email: email.trim() || null, password, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factory-users-list', factoryId] });
      router.refresh();
    },
  });

  if (create.data) {
    const added = create.data;
    return (
      <div className="space-y-4">
        <p className="text-sm">{t('{name} can sign in now as {role}.', { name: added.username, role: t(added.role) })}</p>
        {added.welcome_email?.sent ? (
          <p className="text-sm text-emerald-700">{t('Welcome email with the sign-in details sent to {email}.', { email: added.email ?? '' })}</p>
        ) : (
          <>
            {added.welcome_email && !added.welcome_email.sent && (
              <p className="text-sm text-amber-700">{t('The welcome email did not go: share these details yourself.')}</p>
            )}
            <SignInDetails factoryId={factoryId} username={added.username} password={password} />
          </>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>{t('Done')}</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Field label={t('Username')}>
        <Input autoFocus autoComplete="off" value={username} minLength={3} maxLength={64} required onChange={(e) => setUsername(e.target.value)} />
        <p className="text-xs text-muted">{t('What they type to sign in: their email, a name or a phone number.')}</p>
      </Field>
      <Field label={t('Email (optional)')}>
        <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="text-xs text-muted">{t('With an email, the sign-in details are emailed and a forgotten password can be reset.')}</p>
      </Field>
      <Field label={t('Role')}>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="employee">{t('employee')}</option>
          <option value="admin">{t('admin')}</option>
        </Select>
        <p className="text-xs text-muted">{t('Admins can change everything on the dashboard; employees can only look.')}</p>
      </Field>
      <Field label={t('Password')}>
        <div className="flex gap-2">
          <Input type={shown ? 'text' : 'password'} autoComplete="new-password" className="font-mono" value={password} minLength={8} required onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" size="sm" variant="secondary" onClick={() => setShown((s) => !s)}>{shown ? t('Hide') : t('Show')}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setPassword(generatePassword()); setShown(true); }}>{t('Generate')}</Button>
        </div>
      </Field>
      {create.error && <p className="text-sm text-red-600" role="alert">{reason(create.error)}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>{t('Cancel')}</Button>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? t('Adding…') : t('Add')}</Button>
      </div>
    </form>
  );
}

export function AddPersonButton({ factoryId }: { factoryId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>{t('Add person')}</Button>
      {open && (
        <Sheet title={t('Add person')} onClose={() => setOpen(false)}>
          <AddPersonForm factoryId={factoryId} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}

/** What an admin can do with one account made at this factory: role, access, password, removal. */
export function ManagePersonForm({ factoryId, user, onDone }: { factoryId: string; user: AuthUser; onDone: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['factory-users-list', factoryId] });
    router.refresh();
  };
  const update = useMutation({
    mutationFn: (body: { status?: 'active' | 'disabled'; role?: Role }) => api.factoryUpdateUser(factoryId, user.user_id, body),
    onSuccess: () => { setNote(t('Saved')); refresh(); },
  });
  const setPw = useMutation({
    mutationFn: () => api.factorySetUserPassword(factoryId, user.user_id, password),
    onSuccess: () => { setNote(t('Password updated')); setPassword(''); refresh(); },
  });
  const remove = useMutation({
    mutationFn: () => api.factoryDeleteUser(factoryId, user.user_id),
    onSuccess: () => { refresh(); onDone(); },
  });
  const busy = update.isPending || setPw.isPending || remove.isPending;
  const error = update.error ?? setPw.error ?? remove.error;
  const disabled = user.status === 'disabled';

  return (
    <div className="space-y-5">
      <div className="text-sm">
        <span className="font-medium">{user.username}</span>
        {user.email && <span className="text-muted"> · {user.email}</span>}
        <span className="text-muted"> · {t(user.role)}{disabled ? ` · ${t('disabled')}` : ''}</span>
      </div>

      <Field label={t('Role')}>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={user.role} disabled={busy} onChange={(e) => update.mutate({ role: e.target.value as Role })}>
            <option value="employee">{t('employee')}</option>
            <option value="admin">{t('admin')}</option>
          </Select>
          <span className="text-xs text-muted">{t('Admins can change everything on the dashboard; employees can only look.')}</span>
        </div>
      </Field>

      <Field label={t('New password')}>
        <div className="flex gap-2">
          <Input type="text" autoComplete="new-password" className="font-mono" value={password} minLength={8} placeholder={t('At least 8 characters')} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" size="sm" variant="secondary" onClick={() => setPassword(generatePassword())}>{t('Generate')}</Button>
          <Button type="button" size="sm" className="whitespace-nowrap" disabled={busy || password.length < 8} onClick={() => setPw.mutate()}>{t('Set password')}</Button>
        </div>
        <p className="text-xs text-muted">{t('They are signed out everywhere and sign in with the new password.')}</p>
      </Field>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => update.mutate({ status: disabled ? 'active' : 'disabled' })}>
          {disabled ? t('Enable') : t('Disable')}
        </Button>
        {confirmRemove ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {t('Remove {name}? They will no longer be able to sign in.', { name: user.username })}
            <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => remove.mutate()}>{t('Yes, remove')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>{t('Keep')}</Button>
          </span>
        ) : (
          <Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => setConfirmRemove(true)}>{t('Remove')}</Button>
        )}
      </div>

      {note && !error && <p className="text-sm text-emerald-700" role="status">{note}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{reason(error)}</p>}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>{t('Close')}</Button>
      </div>
    </div>
  );
}

export function ManagePersonSheet({ factoryId, user, onClose }: { factoryId: string; user: AuthUser; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t('Manage {name}', { name: user.username })} onClose={onClose}>
      <ManagePersonForm factoryId={factoryId} user={user} onDone={onClose} />
    </Sheet>
  );
}
