import { DEMO_ACCOUNTS, DEMO_ORG_ID, DEMO_PASSWORD, generateDemoScenario } from './core/index.ts';
import type { Db } from './clients.ts';
import { processExposure } from './exposure.ts';

function must(res: { error: { message: string } | null }, what: string) { if (res.error) throw new Error(`${what}: ${res.error.message}`); }

/** Creates the three public demo logins (or resets their password) and returns their user ids by role. */
export async function ensureDemoUsers(db: Db): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const known: { id: string; email?: string }[] = [];
  for (let page = 1; page <= 50; page++) { // page through all users until the demo accounts are found
    const r = await db.auth.admin.listUsers({ page, perPage: 200 });
    const users = r.data?.users ?? [];
    known.push(...users);
    if (users.length < 200 || DEMO_ACCOUNTS.every((a) => known.some((u) => u.email === a.email))) break;
  }
  for (const a of DEMO_ACCOUNTS) {
    const found = known.find((u) => u.email === a.email);
    if (found) { must(await db.auth.admin.updateUserById(found.id, { password: DEMO_PASSWORD, email_confirm: true }), `update ${a.email}`); out[a.role] = found.id; }
    else {
      const c = await db.auth.admin.createUser({ email: a.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { demo: true } });
      if (c.error || !c.data.user) throw new Error(`create ${a.email}: ${c.error?.message}`);
      out[a.role] = c.data.user.id;
    }
  }
  return out;
}

/** The demo password is public and any signed-in visitor could change it through the auth API; the daily job resets it. */
export async function healDemoLogins(db: Db): Promise<number> {
  const ids = (((await db.from('profiles').select('user_id').eq('org_id', DEMO_ORG_ID)).data ?? []) as { user_id: string }[]).map((p) => p.user_id);
  let healed = 0;
  for (const id of ids) if (!(await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, ban_duration: 'none', email_confirm: true })).error) healed++;
  return healed;
}
export async function resetDemo(db: Db) { must(await db.rpc('demo_reset', { p_org: DEMO_ORG_ID }), 'demo_reset'); }

/** Wipes and recreates the simulated organisation (14 days), then attaches REAL weather exposure from Open-Meteo. */
export async function loadDemo(db: Db, now = new Date(), f: typeof fetch = fetch) {
  const users = await ensureDemoUsers(db);
  const data = generateDemoScenario({ now, ids: { orgId: DEMO_ORG_ID, managerId: users.manager!, agentId: users.field_agent!, receiverId: users.factory_receiver! } });
  const loaded = await db.rpc('demo_load', { p_data: data });
  must(loaded, 'demo_load');
  const profiles = DEMO_ACCOUNTS.map((a) => ({ user_id: users[a.role]!, org_id: DEMO_ORG_ID, role: a.role, name: a.name, language: 'en', email: a.email }));
  must(await db.from('profiles').upsert(profiles, { onConflict: 'user_id' }), 'profiles');
  let exposureStored = 0, exposureUnavailable = 0;
  for (const c of data.checkpoints.filter((x) => x.stage !== 'farm_pickup')) {
    const r = await processExposure(db, c.id as string, f);
    if (r === 'stored') exposureStored++; else exposureUnavailable++;
  }
  return { ...(loaded.data as object), exposureStored, exposureUnavailable };
}
