// Team management (manager only): { action: 'create' | 'reset_password' | 'set_active', ... }.
// The temporary password is returned once and never stored in readable form; the manager hands it over in person.
import { adminClient, requireUser } from '../_shared/clients.ts';
import { env, json, preflight } from '../_shared/http.ts';
import { takeDailyBudget } from '../_shared/budget.ts';
import { createStaff, resetPassword, setActive, type StaffFailure } from '../_shared/staff.ts';

const failure = (f: StaffFailure) => json({ ok: false, code: f.code, error: f.error }, f.status);

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const caller = await requireUser(req); if (caller instanceof Response) return caller;
  if (caller.role !== 'manager') return json({ error: 'managers only' }, 403);
  const admin = adminClient();
  // The shared demo organisation's logins are public; nobody should add real people to it.
  const org = await admin.from('organizations').select('is_demo').eq('id', caller.orgId).maybeSingle();
  if ((org.data as { is_demo: boolean } | null)?.is_demo) return json({ ok: false, code: 'demo_org', error: 'Team management is turned off in the demo.' }, 403);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await takeDailyBudget(admin, `staff:${caller.orgId}`, Number(env('STAFF_ORG_DAILY_LIMIT', '30'))))) return json({ ok: false, code: 'daily_limit', error: 'Too many team changes today.' }, 429);
  switch (body.action) {
    case 'create': { const r = await createStaff(admin, caller.orgId, body); return r.ok ? json({ ok: true, userId: r.userId, tempPassword: r.tempPassword }) : failure(r); }
    case 'reset_password': { const r = await resetPassword(admin, caller.orgId, body.userId); return r.ok ? json({ ok: true, tempPassword: r.tempPassword }) : failure(r); }
    case 'set_active': { const r = await setActive(admin, caller.orgId, caller.userId, body.userId, body.active); return r.ok ? json({ ok: true, active: r.active, sessionsRevoked: r.sessionsRevoked }) : failure(r); }
    default: return json({ ok: false, code: 'invalid', error: "action must be 'create', 'reset_password' or 'set_active'" }, 400);
  }
});
