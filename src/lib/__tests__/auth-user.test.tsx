/**
 * Who is signed in comes with the page (lib/server/session-user.ts → app/layout.tsx → AuthProvider):
 * what depends on it is there from the first draw, and the browser asks only when the server could not tell.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/auth-types';
import { userFromAnswer } from '@/lib/auth-user';

const SRC = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(SRC, file), 'utf8');

const OWNER: AuthUser = { user_id: 'u-1', role: 'admin', factory_id: 'mill', username: 'owner@mill.in', email: 'owner@mill.in', status: 'active' };
const WORKER: AuthUser = { ...OWNER, user_id: 'u-2', role: 'employee', username: 'ravi' };

function Probe() {
  const { user, loading, canWriteFactory, isInternalStaff } = useAuth();
  return <p>{`${loading ? 'asking' : 'known'}|${user?.username ?? 'nobody'}|${canWriteFactory ? 'can change' : 'reads'}|${isInternalStaff ? 'staff' : 'factory'}`}</p>;
}
const drawn = (initialUser?: AuthUser | null) => renderToString(<AuthProvider initialUser={initialUser}><Probe /></AuthProvider>);

describe('the user in the API\'s answer', () => {
  it('wrapped or bare', () => {
    expect(userFromAnswer({ user: OWNER })).toEqual(OWNER);
    expect(userFromAnswer(OWNER)).toEqual(OWNER);
  });
  it('anything else is not a user', () => {
    for (const not of [null, undefined, '', 'owner', 7, [], {}, { user: null }, { error: 'Unauthorized' }, { user: { username: 'x' } }, { role: 'admin' }]) {
      expect(userFromAnswer(not), JSON.stringify(not)).toBeUndefined();
    }
  });
});

describe('the page knows who is signed in from its first draw', () => {
  it('an admin: named, and with what an admin may do', () => {
    expect(drawn(OWNER)).toContain('known|owner@mill.in|can change|factory');
  });
  it('a worker: named, reading only', () => {
    expect(drawn(WORKER)).toContain('known|ravi|reads|factory');
  });
  it('nobody signed in: known too, nothing to ask', () => {
    expect(drawn(null)).toContain('known|nobody|reads|factory');
  });
  it('the server could not tell: the browser asks, as before', () => {
    expect(drawn(undefined)).toContain('asking|nobody|reads|factory');
    expect(drawn()).toContain('asking|nobody');
  });
});

describe('how it gets there', () => {
  it('the root layout asks while it works out the language and hands the answer to the app', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain('const user = sessionUser();');
    expect(layout).toContain('initialUser={await user}');
    expect(read('app/providers.tsx')).toContain('<AuthProvider initialUser={initialUser}>');
  });
  it('the browser asks only when the answer did not come with the page', () => {
    const provider = read('lib/auth-context.tsx');
    expect(provider).toContain('const known = initialUser !== undefined;');
    expect(provider).toMatch(/useEffect\(\(\) => \{\n\s+if \(known\) return;/);
  });
  it('the server tells "nobody" only without any session cookie, and leaves a session to renew to the browser', () => {
    const server = read('lib/server/session-user.ts');
    expect(server).toContain("if (!jar.get(ACCESS_COOKIE)?.value) return jar.get(REFRESH_COOKIE)?.value ? undefined : null;");
    expect(server).toContain('if (!res.ok) return undefined;');
  });
});
