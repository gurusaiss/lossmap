// The real Edge Function code (staff, org setup, demo seed, exposure, sweep) against the migrated database.
import assert from 'node:assert/strict';
import { fakeSupabase, newPool } from './fakeSupabase.mjs';
import { createStaff, resetPassword, setActive } from '../functions/_shared/staff.ts';
import { createOrganization } from '../functions/_shared/orgSetup.ts';
import { healDemoLogins, loadDemo } from '../functions/_shared/demoSeed.ts';
import { processExposure } from '../functions/_shared/exposure.ts';
import { runSweep } from '../functions/_shared/sweep.ts';
import { DEMO_ORG_ID, DEMO_PASSWORD, validateNewPassword } from '../../packages/core/src/index.ts';

const pool = newPool(), db = fakeSupabase(pool);
let passed = 0;
const ok = (c, l) => { assert.ok(c, `FAIL  ${l}`); console.log(`PASS  ${l}`); passed++; };
const rows = async (sql, p = []) => (await pool.query(sql, p)).rows;

// ---- staff -----------------------------------------------------------------------------------------------------------
const ORG = 'f0000000-0000-4000-8000-000000000001', OTHER = 'f0000000-0000-4000-8000-000000000002';
const MGR = 'f1000000-0000-4000-8000-000000000001', MGR2 = 'f1000000-0000-4000-8000-000000000002', OTHER_MGR = 'f1000000-0000-4000-8000-000000000003';
await pool.query("insert into organizations (id, name) values ($1, 'Staff Org'), ($2, 'Other Staff Org')", [ORG, OTHER]);
await pool.query("insert into auth.users (id, email) values ($1, 'boss@staff.test'), ($2, 'boss2@staff.test'), ($3, 'other@staff.test')", [MGR, MGR2, OTHER_MGR]);
await pool.query("insert into profiles (user_id, org_id, role, name, email) values ($1, $4, 'manager', 'Boss', 'boss@staff.test'), ($2, $4, 'manager', 'Boss Two', 'boss2@staff.test'), ($3, $5, 'manager', 'Other Boss', 'other@staff.test')", [MGR, MGR2, OTHER_MGR, ORG, OTHER]);
await pool.query("insert into farmers (org_id, name, village) values ($1, 'F', 'V')", [ORG]);

const made = await createStaff(db, ORG, { name: '  Lakshmi   Devi ', email: ' Lakshmi@Staff.Test ', role: 'field_agent', phone: '+91 98765 43210' });
ok(made.ok && made.tempPassword.length === 12 && validateNewPassword(made.tempPassword) === null, 'adding a person returns a 12-character temporary password that meets the password rules');
const prof = (await rows('select * from profiles where user_id = $1', [made.userId]))[0];
ok(prof.org_id === ORG && prof.role === 'field_agent' && prof.name === 'Lakshmi Devi' && prof.email === 'lakshmi@staff.test' && prof.language === 'te' && !prof.disabled, 'profile is created in the manager\'s organisation with a tidy name, lower-case email and Telugu as the field default');
ok(!JSON.stringify(await rows('select * from profiles where user_id = $1', [made.userId])).includes(made.tempPassword), 'the temporary password is not stored in the database');
const dup = await createStaff(db, ORG, { name: 'Someone Else', email: 'LAKSHMI@staff.test', role: 'factory_receiver' });
ok(!dup.ok && dup.code === 'email_taken' && dup.status === 409, 'the same email cannot be added twice (case-insensitive)');
ok((await createStaff(db, OTHER, { name: 'Intruder', email: 'boss@staff.test', role: 'field_agent' })).code === 'email_taken', 'an email that belongs to another organisation is refused without revealing which');
for (const bad of [{ name: 'A', email: 'a@b.co', role: 'field_agent' }, { name: 'Ok Name', email: 'nope', role: 'field_agent' }, { name: 'Ok Name', email: 'ok@staff.test', role: 'admin' }]) ok((await createStaff(db, ORG, bad)).code === 'invalid', `invalid input is rejected (${bad.role}/${bad.email})`);
const before = (await rows('select count(*)::int n from auth.users'))[0].n;
const orphan = await createStaff(db, 'f0000000-0000-4000-8000-0000000000ff', { name: 'Ghost Org', email: 'ghost@staff.test', role: 'field_agent' });
ok(orphan.code === 'profile_failed' && (await rows('select count(*)::int n from auth.users'))[0].n === before, 'if the profile cannot be saved the new login is removed again (no half-created account)');

const reset = await resetPassword(db, ORG, made.userId);
ok(reset.ok && reset.tempPassword !== made.tempPassword && db.auth.admin.log.some((e) => e.id === made.userId && e.password === reset.tempPassword), 'reset sets a new temporary password for that user');
const cross = await resetPassword(db, ORG, OTHER_MGR);
ok(cross.status === 404 && !db.auth.admin.log.some((e) => e.id === OTHER_MGR), 'a manager cannot reset a password in another organisation (looks like not found, nothing changed)');
ok((await resetPassword(db, ORG, "x'; drop table profiles;--")).status === 404, 'garbage user ids are treated as not found');

const asUser = async (uid) => { const c = await pool.connect(); await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]); return c; };
const release = async (c) => { await c.query("select set_config('request.jwt.claim.sub', '', false)"); await c.query('set role service_role'); c.release(); };
const farmersSeen = async (uid) => { const c = await asUser(uid); const n = (await c.query('select count(*)::int n from farmers')).rows[0].n; await release(c); return n; };
ok((await farmersSeen(made.userId)) === 1, 'an active team member sees their organisation\'s data');
const off = await setActive(db, ORG, MGR, made.userId, false);
ok(off.ok && off.sessionsRevoked && db.auth.admin.log.some((e) => e.id === made.userId && e.ban_duration && e.ban_duration !== 'none'), 'disabling flags the profile and bans the login');
ok((await farmersSeen(made.userId)) === 0, 'a disabled person immediately sees nothing, even with a token that is still valid');
ok((await setActive(db, ORG, MGR, made.userId, true)).ok && (await farmersSeen(made.userId)) === 1, 're-enabling lifts the ban and access returns');
ok((await setActive(db, ORG, MGR, MGR, false)).code === 'cannot_disable_self', 'a manager cannot disable themselves');
ok((await setActive(db, ORG, MGR, MGR2, false)).ok, 'one of two managers can be disabled by the other');
ok((await setActive(db, ORG, 'f1000000-0000-4000-8000-0000000000aa', MGR, false)).code === 'last_manager', 'the last active manager cannot be disabled');
await setActive(db, ORG, MGR, MGR2, true);
ok((await setActive(db, ORG, MGR, OTHER_MGR, false)).status === 404 && !(await rows('select disabled from profiles where user_id = $1', [OTHER_MGR]))[0].disabled, 'another organisation\'s people cannot be disabled');

// ---- organisation onboarding -------------------------------------------------------------------------------------------
const org = await createOrganization(db, { orgName: '  Sri  Tomato Processors ', orgType: 'processor', managerName: 'Anita Rao', managerEmail: 'Anita@Sri.Test' });
ok(org.ok && (await rows('select * from organizations where id = $1', [org.orgId]))[0].name === 'Sri Tomato Processors' && !(await rows('select is_demo from organizations where id = $1', [org.orgId]))[0].is_demo, 'a new real organisation is created with its first manager');
ok((await rows('select role, email from profiles where user_id = $1', [org.userId]))[0].role === 'manager', 'the first manager belongs to it');
ok(!(await createOrganization(db, { orgName: 'Broken Org', orgType: 'fpo', managerName: 'X', managerEmail: 'nope' })).ok && !(await rows("select 1 from organizations where name = 'Broken Org'")).length, 'if the manager is invalid no organisation is left behind');
ok((await createOrganization(db, { orgName: 'Dup Org', orgType: 'fpo', managerName: 'Anita Again', managerEmail: 'anita@sri.test' })).code === 'email_taken' && !(await rows("select 1 from organizations where name = 'Dup Org'")).length, 'a manager email that already has an account is refused and the organisation removed again');

// ---- demo seed with fake weather -------------------------------------------------------------------------------------------
const fakeWeather = async (url) => {
  const u = new URL(String(url)); const past = Number(u.searchParams.get('past_days')), time = [], t = [];
  for (let d = past; d >= 0; d--) { const day = new Date(Date.parse('2026-10-21T00:00:00Z') - d * 86400000).toISOString().slice(0, 10); for (let h = 0; h < 24; h++) { time.push(`${day}T${String(h).padStart(2, '0')}:00`); t.push(h >= 5 && h < 11 ? 36 : 27); } } // hot window 05:00-11:00 GMT = 10:30-16:30 IST
  return new Response(JSON.stringify({ hourly: { time, temperature_2m: t } }));
};
const NOW = new Date('2026-10-21T08:00:00Z');
const r = await loadDemo(db, NOW, fakeWeather);
ok(r.lots === 114 && r.exposureStored > 300, `the demo loads ${r.lots} lots and stores exposure for ${r.exposureStored} segments`);
ok(Number((await rows("select count(*) from weather_cache"))[0].count) > 0, 'weather is cached per cell and day for reuse');
const hot = (await rows("select count(*)::int n from segment_exposure where heat_hours >= 1"))[0].n;
ok(hot > 50, `${hot} segments carry real-looking heat hours from the (fake) weather response`);
const causes = Object.fromEntries((await rows('select cause_rule, count(*)::int n from lot_segments where org_id = $1 group by 1', [DEMO_ORG_ID])).map((r) => [r.cause_rule, r.n]));
ok(causes.R1_heat_during_waiting > 20, `heat during waiting is tagged on ${causes.R1_heat_during_waiting} segments once weather is attached`);
ok((await healDemoLogins(db)) >= 3 && db.auth.admin.log.some((e) => e.password === DEMO_PASSWORD && e.ban_duration === 'none'), 'the keep-alive job resets the three public demo logins to the published password');

// ---- weather failure handling --------------------------------------------------------------------------------------------
const cpIds = (await rows("select id from checkpoints where org_id = $1 and stage = 'centre_arrival' limit 1", [DEMO_ORG_ID]));
await pool.query('delete from segment_exposure where to_checkpoint_id = $1', [cpIds[0].id]); await pool.query('delete from weather_cache');
const down = await processExposure(db, cpIds[0].id, async () => new Response('no', { status: 503 }));
ok(down === 'weather_failed' && !(await rows('select 1 from segment_exposure where to_checkpoint_id = $1', [cpIds[0].id])).length, 'a transient weather failure is not stored (it will be retried), never recorded as "unavailable"');
ok((await processExposure(db, cpIds[0].id, fakeWeather)) === 'stored', 'once the weather answers the exposure is stored');

// ---- alert sweep ------------------------------------------------------------------------------------------------------------
const sent = [];
const realFetch = globalThis.fetch; globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); };
await pool.query("update organizations set telegram_chat_id = 12345 where id = $1", [DEMO_ORG_ID]);
const s1 = await runSweep(db, { telegramToken: 'tok', onlyOrg: DEMO_ORG_ID, now: NOW });
ok(s1.created === 2, 'the sweep creates one alert for each of the two waiting lots');
ok(sent.length === 2 && sent.some((m) => /T-\d+ has waited 3\.4 h/.test(m.text) && /Dispatch now/.test(m.text)), 'and delivers them to Telegram: "Lot … has waited 3.4 h … Dispatch now."');
const s2 = await runSweep(db, { telegramToken: 'tok', onlyOrg: DEMO_ORG_ID, now: NOW });
ok(s2.created === 0 && sent.length === 2, 'the next sweep is deduplicated and sends nothing twice');
globalThis.fetch = realFetch;
await pool.end();
console.log(`ALL SERVER TESTS PASSED (${passed})`);
