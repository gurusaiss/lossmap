export const STAFF_ROLES = ['field_agent', 'factory_receiver', 'manager'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffInput { name: string; email: string; role: StaffRole; phone: string | null; language: 'en' | 'te' }
export type StaffValidation = { ok: true; value: StaffInput } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Checks what a manager typed when adding a team member. Field staff default to Telugu, managers to English. */
export function validateStaffInput(raw: unknown): StaffValidation {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
  const role = o.role;
  const phoneRaw = typeof o.phone === 'string' ? o.phone.trim() : '';
  if (name.length < 2 || name.length > 80) return { ok: false, error: 'Enter the person\'s name (2 to 80 characters).' };
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (typeof role !== 'string' || !(STAFF_ROLES as readonly string[]).includes(role)) return { ok: false, error: 'Choose a role.' };
  if (phoneRaw !== '' && !/^\+?[0-9 ]{7,15}$/.test(phoneRaw)) return { ok: false, error: 'Phone number looks wrong.' };
  const language = o.language === 'en' || o.language === 'te' ? o.language : role === 'manager' ? 'en' : 'te';
  return { ok: true, value: { name, email, role: role as StaffRole, phone: phoneRaw === '' ? null : phoneRaw, language } };
}

// No look-alike characters (0/O, 1/l/I) so the password can be read out or copied by hand from a phone screen.
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

type RandomBytes = (n: number) => Uint8Array;
const defaultBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Uniform integer in [0, n) for n <= 256, without modulo bias (rejection sampling). */
function randInt(n: number, bytes: RandomBytes): number {
  const limit = 256 - (256 % n);
  for (;;) for (const b of bytes(32)) if (b < limit) return b % n;
}
const pick = (set: string, bytes: RandomBytes) => set[randInt(set.length, bytes)]!;

/** A temporary password: 12 characters with at least one lower-case letter, one upper-case letter and one digit. */
export function generateTempPassword(bytes: RandomBytes = defaultBytes, length = 12): string {
  const chars = [pick(LOWER, bytes), pick(UPPER, bytes), pick(DIGITS, bytes)];
  while (chars.length < length) chars.push(pick(ALL, bytes));
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1, bytes); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join('');
}

/** What the "choose your own password" form requires. */
export function validateNewPassword(pw: string): string | null {
  if (pw.length < 10) return 'tooShort';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'tooSimple';
  return null;
}
