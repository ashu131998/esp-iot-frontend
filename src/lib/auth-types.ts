/** Shared auth types. Safe to import from both client and server code. */

export const ACCESS_COOKIE = 'esp_access';
export const REFRESH_COOKIE = 'esp_refresh';
export const CSRF_COOKIE = 'esp_csrf';

export type Role = 'super_admin' | 'admin' | 'employee';
export type UserStatus = 'active' | 'pending' | 'disabled';

export interface AuthUser {
  user_id: string;
  role: Role;
  factory_id: string | null;
  username: string;
  email: string | null;
  status: UserStatus;
  created_at?: string;
  last_login_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

/**
 * Claims we expect inside the HS256 access token. The backend is authoritative;
 * the frontend only reads these for route protection (middleware) and UX.
 * Assumption to verify against the backend contract: the access token carries
 * `role` and `factory_id` claims, with `sub` (or `user_id`) as the user id.
 */
export interface AccessTokenClaims {
  sub?: string;
  user_id?: string;
  role: Role;
  factory_id: string | null;
  username?: string;
  status?: UserStatus;
  exp?: number;
  iat?: number;
}

/** A user as returned by the admin/factory management endpoints. */
export interface ManagedUser {
  user_id: string;
  username: string;
  email: string | null;
  role: Role;
  factory_id: string | null;
  status: UserStatus;
  created_at?: string | null;
}

export interface OnboardFactoryInput {
  factory_id: string;
  name: string;
  location?: string;
  admin_username: string;
  admin_password: string;
}

export function isSuperAdmin(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'super_admin';
}

export function canAccessFactory(
  user: Pick<AuthUser, 'role' | 'factory_id'> | null | undefined,
  factoryId: string,
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.factory_id === factoryId;
}
