import { isStaffRole } from '@/lib/internal-auth';

/**
 * The factory our staff opened Stock for in the FloorBeat app (dashboard.floorbeat.in/factories/<id>/ims/…): the IMS
 * app's screens otherwise work on the session's factory, and our staff belong to none. Set by the middleware only (the
 * browser's own copy is dropped there), from the address.
 */
export const STAFF_FACTORY_HEADER = 'x-floorbeat-staff-factory';

/**
 * Which factory the IMS app's screens are for: a factory account's own, always (whatever the header says); for our
 * staff the one their address named; none for anyone else, or for our staff without one.
 */
export function imsFactoryOf(
  user: { role?: string; factory_id?: string | null } | null | undefined,
  named: string | null | undefined,
): string | null {
  if (!user) return null;
  if (user.factory_id) return user.factory_id;
  return isStaffRole(user.role) && named ? named : null;
}
