'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AuthUser } from '@/lib/auth-types';
import { fetchWithSignal, isAbortError } from '@/lib/request-signal';

function getCsrfFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)esp_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

async function fetchCsrf(signal?: AbortSignal): Promise<string> {
  const res = await fetchWithSignal('/api/auth/login', { credentials: 'same-origin', signal });
  const data = await res.json();
  return data.csrf ?? getCsrfFromCookie();
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (body: Record<string, unknown>) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchWithSignal('/api/auth/me', { credentials: 'same-origin', signal });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch (error) {
      if (isAbortError(error)) return;
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (body: Record<string, unknown>) => {
    let csrf = getCsrfFromCookie();
    if (!csrf) csrf = await fetchCsrf();
    const res = await fetchWithSignal('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Login failed');
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const csrf = getCsrfFromCookie();
    await fetchWithSignal('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrf },
    });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      isSuperAdmin: user?.role === 'super_admin',
      isAdmin: user?.role === 'admin',
      isEmployee: user?.role === 'employee',
    }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getClientCsrf(): string {
  return getCsrfFromCookie();
}
