// Team management for managers: add a person, reset their password, disable or re-enable them.
// Runs with the service-role client AFTER the caller has been checked to be a manager, so every query is scoped to `orgId` here.
import { generateTempPassword, validateStaffInput } from './core/index.ts';
import type { Db } from './clients.ts';

export type StaffFailure = { ok: false; status: number; code: string; error: string };
export type StaffOutcome<T> = ({ ok: true } & T) | StaffFailure;
const fail = (status: number, code: string, error: string): StaffFailure => ({ ok: false, status, code, error });
const BAN_FOREVER = '876000h';
const isDuplicateEmail = (e: { code?: string; message?: string }) => e.code === 'email_exists' || e.code === 'user_already_exists' || /already (been )?registered|already exists/i.test(e.message ?? '');

export async function createStaff(admin: Db, orgId: string, raw: unknown): Promise<StaffOutcome<{ userId: string; tempPassword: string }>> {
  const v = validateStaffInput(raw);
  if (!v.ok) return fail(400, 'invalid', v.error);
  const tempPassword = generateTempPassword();
  const created = await admin.auth.admin.createUser({ email: v.value.email, password: tempPassword, email_confirm: true, user_metadata: { temp_password: true } });
  if (created.error || !created.data.user) {
    const e = created.error ?? { message: 'no user returned' };
    return isDuplicateEmail(e) ? fail(409, 'email_taken', 'That email already has an account.') : fail(500, 'create_failed', 'Could not create the login.');
  }
  const userId = created.data.user.id;
  const prof = await admin.from('profiles').insert({ user_id: userId, org_id: orgId, role: v.value.role, name: v.value.name, phone: v.value.phone, language: v.value.language, email: v.value.email });
  if (prof.error) { await admin.auth.admin.deleteUser(userId); return fail(500, 'profile_failed', 'Could not save the team member.'); }
  return { ok: true, userId, tempPassword };
}

/** The target must belong to the manager's organisation; anything else looks like "not found" so other organisations cannot be probed. */
async function memberOf(admin: Db, orgId: string, userId: unknown) {
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const r = await admin.from('profiles').select('user_id, role, disabled').eq('user_id', userId).eq('org_id', orgId).maybeSingle();
  return r.data as { user_id: string; role: string; disabled: boolean } | null;
}

export async function resetPassword(admin: Db, orgId: string, userId: unknown): Promise<StaffOutcome<{ tempPassword: string }>> {
  const m = await memberOf(admin, orgId, userId);
  if (!m) return fail(404, 'not_found', 'Team member not found.');
  const tempPassword = generateTempPassword();
  const r = await admin.auth.admin.updateUserById(m.user_id, { password: tempPassword, user_metadata: { temp_password: true } });
  return r.error ? fail(500, 'reset_failed', 'Could not reset the password.') : { ok: true, tempPassword };
}

export async function setActive(admin: Db, orgId: string, actorId: string, userId: unknown, active: unknown): Promise<StaffOutcome<{ active: boolean; sessionsRevoked: boolean }>> {
  if (typeof active !== 'boolean') return fail(400, 'invalid', 'active must be true or false.');
  const m = await memberOf(admin, orgId, userId);
  if (!m) return fail(404, 'not_found', 'Team member not found.');
  if (!active) {
    if (m.user_id === actorId) return fail(400, 'cannot_disable_self', 'You cannot disable your own account.');
    if (m.role === 'manager' && !m.disabled) {
      const others = await admin.from('profiles').select('user_id').eq('org_id', orgId).eq('role', 'manager').eq('disabled', false).neq('user_id', m.user_id);
      if (!others.data || others.data.length === 0) return fail(400, 'last_manager', 'At least one active manager is needed.');
    }
  }
  if (active) {
    const lifted = await admin.auth.admin.updateUserById(m.user_id, { ban_duration: 'none' });
    if (lifted.error) return fail(500, 'enable_failed', 'Could not enable the login.');
  }
  // Disabling flips the profile first: row-level security cuts access at once, even while the old token is still valid.
  const upd = await admin.from('profiles').update({ disabled: !active }).eq('user_id', m.user_id).eq('org_id', orgId);
  if (upd.error) return fail(500, 'update_failed', 'Could not update the team member.');
  if (active) return { ok: true, active: true, sessionsRevoked: false };
  const ban = await admin.auth.admin.updateUserById(m.user_id, { ban_duration: BAN_FOREVER });
  return { ok: true, active: false, sessionsRevoked: !ban.error };
}
