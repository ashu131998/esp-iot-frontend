/**
 * The Team page's forms (factory/team-accounts.tsx), rendered on the server: adding a person asks
 * for what the backend needs and explains the roles; managing one offers role, password, access
 * and removal, never for yourself (the panel hides that). In Hindi too.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/lib/auth-types';
import { hi } from '@/lib/i18n/messages/hi';
import { LocaleProvider } from '@/lib/i18n/context';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { AddPersonForm, ManagePersonForm, AddPersonButton } = await import('@/components/factory/team-accounts');

function render(node: ReactNode, locale: 'en' | 'hi' = 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <LocaleProvider locale={locale} messages={locale === 'hi' ? hi : {}}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </LocaleProvider>,
  ).replaceAll('<!-- -->', '');
}
const ravi: AuthUser = { user_id: 'u-ravi', role: 'employee', factory_id: 'mill', username: 'ravi', email: 'ravi@mill.in', status: 'active' };
const noop = () => {};

describe('adding a person', () => {
  it('a username, an optional email, the role explained, a password already generated', () => {
    const html = render(<AddPersonForm factoryId="mill" onDone={noop} />);
    for (const text of ['Username', 'Email (optional)', 'Role', 'Password', 'Admins can change everything on the dashboard; employees can only look.', 'Generate', '>Add<']) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/<option value="employee"[^>]*>employee<\/option>/);
    expect(html).toMatch(/<option value="admin">admin<\/option>/);
    expect(html).toMatch(/name="password"|autocomplete="new-password"/i);
    expect(html).toMatch(/value="[^"]{12,}"/);   // a password to hand over, generated
    expect(render(<AddPersonButton factoryId="mill" />)).toContain('Add person');
  });

  it('in Hindi', () => {
    const html = render(<AddPersonForm factoryId="mill" onDone={noop} />, 'hi');
    expect(html).toContain('एडमिन डैशबोर्ड पर सब कुछ बदल सकते हैं');
    expect(html).toContain('बनाएँ');
  });
});

describe('managing a person', () => {
  it('who they are, their role to change, a new password, disable and remove', () => {
    const html = render(<ManagePersonForm factoryId="mill" user={ravi} onDone={noop} />);
    expect(html).toContain('ravi');
    expect(html).toContain('ravi@mill.in');
    expect(html).toMatch(/<select[^>]*>[\s\S]*<option value="employee"[^>]*selected/);
    for (const text of ['New password', 'Set password', 'Disable', 'Remove', 'They are signed out everywhere']) expect(html).toContain(text);
    expect(html).not.toContain('Enable');
  });

  it('a disabled account offers Enable; an admin is shown as one', () => {
    const html = render(<ManagePersonForm factoryId="mill" user={{ ...ravi, role: 'admin', status: 'disabled' }} onDone={noop} />);
    expect(html).toContain('Enable');
    expect(html).not.toMatch(/>Disable</);
    expect(html).toContain('disabled');
    expect(html).toMatch(/<option value="admin"[^>]*selected/);
  });
});
