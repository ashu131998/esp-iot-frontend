'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import type { AuthUser, UserStatus } from '@/lib/auth-types';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { isInternalAdmin, isPlatformOwner } from '@/lib/internal-auth';

export function UserAdminActions({ target }: { target: AuthUser }) {
  const { user: actor } = useAuth();
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const owner = isPlatformOwner(actor);
  const internalAdmin = isInternalAdmin(actor);
  const isStaffAccount = !target.factory_id;
  const isFactoryEmployee = target.factory_id && target.role === 'employee';

  const canResetPassword =
    owner && isStaffAccount && target.role !== 'super_admin' && target.user_id !== actor?.user_id;

  const canSetStatus =
    (owner && target.user_id !== actor?.user_id) ||
    (internalAdmin && isFactoryEmployee && target.status !== 'pending');

  const resetPw = useMutation({
    mutationFn: () => api.adminResetPassword(target.user_id, password),
    onSuccess: () => {
      setMessage('Password updated.');
      setPassword('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const patchStatus = useMutation({
    mutationFn: (status: UserStatus) => api.adminUpdateUser(target.user_id, { status }),
    onSuccess: () => {
      setMessage('Status updated.');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  if (!canResetPassword && !canSetStatus) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {canSetStatus && (
        <Field label="Status">
          <Select
            value={target.status}
            disabled={patchStatus.isPending}
            onChange={(e) => patchStatus.mutate(e.target.value as UserStatus)}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
            {owner && <option value="pending">pending</option>}
          </Select>
        </Field>
      )}
      {canResetPassword && (
        <>
          <Field label="New password">
            <Input
              type="password"
              value={password}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 chars"
            />
          </Field>
          <Button
            size="sm"
            variant="secondary"
            disabled={resetPw.isPending || password.length < 8}
            onClick={() => resetPw.mutate()}
          >
            Reset password
          </Button>
        </>
      )}
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
