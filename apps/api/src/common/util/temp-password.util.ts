import { randomInt } from 'crypto';

// Excludes visually-ambiguous characters (0/O, 1/l/I) since this is meant to
// be read off a screen and retyped by whoever it's issued to.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// Used for one-time temporary passwords issued alongside a new staff login
// (see EmployeesService.createLoginInternal()) — cryptographically random,
// not a predictable pattern, since it's a real (if short-lived) credential.
export function generateTemporaryPassword(length = 12): string {
  return Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join('');
}
