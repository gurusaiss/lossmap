// End-to-end check against a LIVE Supabase project (never run in this repository's sandbox: it needs your credentials).
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [SUPABASE_SERVICE_ROLE_KEY=...] [CRON_SECRET=...] node scripts/smoke.mjs
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY.'); process.exit(2); }
const PASSWORD = 'LossMap-Demo-2026';
let failed = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra ? `  [${extra}]` : ''}`); if (!cond) failed++; };
const fn = async (name, init) => { const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, init); return { status: r.status, body: await r.json().catch(() => null) }; };
const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email) { const c = client(); const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD }); if (error) throw new Error(`login ${email}: ${error.message}`); return c; }
const bearer = async (c) => ({ Authorization: `Bearer ${(await c.auth.getSession()).data.session.access_token}`, apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' });

if (SUPABASE_SERVICE_ROLE_KEY) {
  const r = await fn('demo-seed', { method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: '{"action":"load"}' });
  ok('demo-seed loads 114 lots', r.status === 200 && r.body?.lots === 114, JSON.stringify(r.body));
} else console.log('SKIP  demo-seed (no service role key; assumes the demo data is already loaded)');

const manager = await signIn('manager@demo.lossmap.app'), agent = await signIn('agent@demo.lossmap.app');
const kpi = (await manager.rpc('dashboard_kpis', {})).data?.[0];
ok('manager sees the demo KPIs', kpi?.lots === 114 && Number(kpi.loss_pct) > 3, JSON.stringify(kpi));
ok('agent sees no loss analytics (manager-only)', ((await agent.from('lot_segments').select('lot_id').limit(1)).data ?? []).length === 0);
ok('agent cannot read server-only tables', !!(await agent.from('ai_cache').select('photo_hash').limit(1)).error);
ok('agent cannot read the Telegram chat id', !!(await agent.from('organizations').select('telegram_chat_id').limit(1)).error);
const lot = (await manager.from('lots').select('id, public_token').limit(1)).data?.[0];
const rep = await client().rpc('get_public_lot_report', { p_token: lot?.public_token ?? 'x' });
ok('the public farmer report opens without login', (rep.data ?? []).length === 1);
ok('a short token returns nothing', ((await client().rpc('get_public_lot_report', { p_token: 'short' })).data ?? []).length === 0);

const mAuth = await bearer(manager), aAuth = await bearer(agent);
const ai = await fn('ai-read-scale', { method: 'POST', headers: aAuth, body: JSON.stringify({ image_base64: 'A'.repeat(200) }) });
ok('ai-read-scale answers 200 with ok/reason (never blocks)', ai.status === 200 && typeof ai.body?.ok === 'boolean', JSON.stringify(ai.body));
if (ai.body?.reason === 'not_configured') console.log('NOTE  no AI provider is set (GROQ_API_KEY/GROQ_MODEL or GEMINI_API_KEY/GEMINI_MODEL): AI falls back to manual entry.');
const ins = await fn('insights-summary', { method: 'POST', headers: mAuth, body: '{"days":14}' });
ok('insights-summary returns a summary', ins.status === 200 && !!ins.body?.text_en, JSON.stringify(ins.body));
ok('agent cannot generate insights', (await fn('insights-summary', { method: 'POST', headers: aAuth, body: '{}' })).status === 403);
ok('agent cannot manage staff', (await fn('staff', { method: 'POST', headers: aAuth, body: '{"action":"set_active","userId":"00000000-0000-0000-0000-000000000000","active":false}' })).status === 403);
const sd = await fn('staff', { method: 'POST', headers: mAuth, body: '{"action":"create","name":"Smoke Test","email":"smoke@example.test","role":"field_agent"}' });
ok('staff function refuses to add people to the demo organisation', sd.status === 403 && sd.body?.code === 'demo_org', JSON.stringify(sd.body));
ok('agent cannot call demo-seed', (await fn('demo-seed', { method: 'POST', headers: aAuth, body: '{"action":"reset"}' })).status === 403);
if (CRON_SECRET) {
  ok('check-alerts works with the cron secret', (await fn('check-alerts', { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET } })).body?.ok === true);
  ok('check-alerts refuses without it', (await fn('check-alerts', { method: 'POST' })).status === 401);
} else console.log('SKIP  cron endpoints (no CRON_SECRET)');
console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL SMOKE CHECKS PASSED');
process.exit(failed ? 1 : 0);
