import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { env, json } from './http.ts';

export type Db = SupabaseClient;

/** Service-role client: bypasses RLS. Only used inside functions after the caller has been authorised. */
export const adminClient = (): Db => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

/** Client acting as the caller, so RLS applies to every query. */
export const userClient = (req: Request): Db => createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
  global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false, autoRefreshToken: false } });

export interface Caller { userId: string; orgId: string; role: string; db: Db }
export async function requireUser(req: Request): Promise<Caller | Response> {
  const db = userClient(req);
  const { data: u, error } = await db.auth.getUser();
  if (error || !u.user) return json({ error: 'unauthorized' }, 401);
  const { data: p } = await db.from('profiles').select('org_id, role').eq('user_id', u.user.id).maybeSingle();
  if (!p) return json({ error: 'no profile' }, 403); // disabled people see no profile
  return { userId: u.user.id, orgId: p.org_id as string, role: p.role as string, db };
}

/** For cron endpoints without a user JWT: constant-time compare of the shared secret. */
export function hasCronSecret(req: Request): boolean {
  const want = env('CRON_SECRET'), got = req.headers.get('x-cron-secret') ?? '';
  if (!want || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
export const isServiceRole = (req: Request) => { const k = env('SUPABASE_SERVICE_ROLE_KEY'); return k !== '' && req.headers.get('Authorization') === `Bearer ${k}`; };
