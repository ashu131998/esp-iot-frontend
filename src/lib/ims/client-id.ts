/**
 * An id made on the phone for a scan or a photo (a UUID, version 4), so sending it twice counts once.
 * crypto.randomUUID where the phone has it; older phones (iOS before 15.4) make one from random bytes.
 */

/** A version-4 UUID from 16 random bytes. */
export function uuidFromBytes(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes.slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newClientId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
}
