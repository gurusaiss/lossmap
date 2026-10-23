import { supabase } from './supabase.ts';
import type { Role } from '@lossmap/core';

export interface TeamMember { user_id: string; name: string; role: Role; email: string | null; phone: string | null; disabled: boolean }
export async function listTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from('profiles').select('user_id, name, role, email, phone, disabled').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
}
export type StaffResult<T> = ({ ok: true } & T) | { ok: false; code: string };
const KNOWN = ['invalid', 'email_taken', 'not_found', 'cannot_disable_self', 'last_manager', 'daily_limit', 'demo_org', 'network'];
export const staffErrorKey = (code: string) => `staffErr_${KNOWN.includes(code) ? code : 'failed'}`;

/** The function answers failures with a JSON body and a non-2xx status; supabase-js hands that back as `error.context`. */
async function call<T>(body: Record<string, unknown>): Promise<StaffResult<T>> {
  if (!navigator.onLine) return { ok: false, code: 'network' };
  const { data, error } = await supabase.functions.invoke('staff', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') { const j = (await ctx.json().catch(() => null)) as { code?: unknown } | null; return { ok: false, code: typeof j?.code === 'string' ? j.code : 'failed' }; }
    return { ok: false, code: 'network' };
  }
  const d = data as ({ ok?: boolean; code?: string } & T) | null;
  return d && d.ok === true ? (d as StaffResult<T>) : { ok: false, code: d?.code ?? 'failed' };
}
export interface NewMember { name: string; email: string; role: Role; phone: string }
export const addStaff = (m: NewMember) => call<{ userId: string; tempPassword: string }>({ action: 'create', ...m });
export const resetStaffPassword = (userId: string) => call<{ tempPassword: string }>({ action: 'reset_password', userId });
export const setStaffActive = (userId: string, active: boolean) => call<{ active: boolean }>({ action: 'set_active', userId, active });
