import type { Page, Route } from '@playwright/test';
import managerData from './managerData.json' with { type: 'json' };

/**
 * TEST-ONLY network mock of the Supabase REST/auth/storage/functions endpoints, so the UI can be exercised in a real browser before a real
 * Supabase project exists. The manager figures in managerData.json are the output of the REAL SQL views over the simulated demo scenario.
 */
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const AGENT = 'a1000000-0000-0000-0000-000000000002', MANAGER = 'a1000000-0000-0000-0000-000000000001', ORG = 'a0000000-0000-0000-0000-000000000001';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: AGENT, role: 'authenticated', exp: 4102444800 })}.sig`;

export const fixtures = {
  farmers: [{ id: 'f1', name: 'Ravi', village: 'Kothapalli' }],
  crops: [{ id: 'c1', name: 'Tomato', name_te: 'టమాటా', code_prefix: 'T', price_per_kg: 20, heat_threshold_c: 30, max_safe_wait_hours: 3, damaged_value_factor: 0.5, unit_tolerance_pct: 1 }],
  centres: [
    { id: 'de040000-0000-4000-8000-000000000001', name: 'Centre A', type: 'collection_centre', lat: 13.55, lng: 78.5, radius_m: 300, expected_transport_h: 1 },
    { id: 'de040000-0000-4000-8000-000000000002', name: 'Centre B', type: 'collection_centre', lat: 13.3667, lng: 78.57, radius_m: 300, expected_transport_h: 1.8 },
    { id: 'de040000-0000-4000-8000-000000000003', name: 'Factory', type: 'factory', lat: 13.2172, lng: 79.1003, radius_m: 500, expected_transport_h: null },
  ],
  transporters: [{ id: 't1', name: 'Sri Transport', vehicle_no: 'AP39 1234' }],
};
const seg = (o: Record<string, unknown>) => ({ lot_id: 'lot-1043', lot_code: 'T-1043', centre_id: 'de040000-0000-4000-8000-000000000001', transporter_id: null, measurement_variance: false, quality_assessed: true, heat_hours: null, avg_temp_c: null, max_temp_c: null, exposure_status: null, max_safe_wait_hours: null, expected_transport_h: null, quality_drop_points: null, ...o });
// A single hand-made lot for the lot-detail screen (the 942.40 waiting segment is the hand-calculated unit-test case).
const segments = [
  seg({ seg_index: 0, to_checkpoint_id: 'cp1', from_stage: 'farm_pickup', to_stage: 'centre_arrival', kind: 'handling_in', started_at: '2026-10-10T02:30:00Z', ended_at: '2026-10-10T03:30:00Z', duration_h: 1, weight_from_kg: 250, weight_to_kg: 248, weight_loss_rs: 37.6, quality_loss_rs: 0, total_loss_rs: 37.6, loss_pct: 0.8, cause_rule: 'within_tolerance' }),
  seg({ seg_index: 1, to_checkpoint_id: 'cp2', from_stage: 'centre_arrival', to_stage: 'centre_dispatch', kind: 'waiting', started_at: '2026-10-10T03:30:00Z', ended_at: '2026-10-10T08:30:00Z', duration_h: 5, weight_from_kg: 248, weight_to_kg: 240, weight_loss_rs: 150.4, quality_loss_rs: 792, total_loss_rs: 942.4, loss_pct: 20.21, heat_hours: 3, avg_temp_c: 33.2, max_temp_c: 35, exposure_status: 'ok', max_safe_wait_hours: 3, cause_rule: 'R1_heat_during_waiting' }),
  seg({ seg_index: 2, to_checkpoint_id: 'cp3', from_stage: 'centre_dispatch', to_stage: 'factory_arrival', kind: 'transport', transporter_id: 't1', started_at: '2026-10-10T08:30:00Z', ended_at: '2026-10-10T10:30:00Z', duration_h: 2, weight_from_kg: 240, weight_to_kg: 238, weight_loss_rs: 31, quality_loss_rs: 238, total_loss_rs: 269, loss_pct: 7.23, expected_transport_h: 1, cause_rule: 'R3_transport_delay' }),
];
const cpRow = (id: string, stage: string, at: string, w: number, q: [number, number, number], centre: string | null) => ({ id, lot_id: 'lot-1043', stage, centre_id: centre, weight_kg: w, weight_source: 'manual', crate_count: 12, quality_good_pct: q[0], quality_damaged_pct: q[1], quality_rotten_pct: q[2], scale_photo_url: null, produce_photo_url: null, device_captured_at: at, flags: [], offline_synced: false });
const seeded = [cpRow('cp0', 'farm_pickup', '2026-10-10T02:30:00Z', 250, [90, 8, 2], null), cpRow('cp1', 'centre_arrival', '2026-10-10T03:30:00Z', 248, [90, 8, 2], 'de040000-0000-4000-8000-000000000001'), cpRow('cp2', 'centre_dispatch', '2026-10-10T08:30:00Z', 240, [65, 25, 10], 'de040000-0000-4000-8000-000000000001'), cpRow('cp3', 'factory_arrival', '2026-10-10T10:30:00Z', 238, [60, 25, 15], 'de040000-0000-4000-8000-000000000003')];

export interface Recorded { checkpoints: Record<string, unknown>[]; lots: Record<string, unknown>[]; farmers: Record<string, unknown>[]; uploads: string[]; uploadAttempts: string[]; order: string[]; functionCalls: string[]; staffCalls: Record<string, unknown>[]; inserts: { path: string; body: Record<string, unknown> }[]; patches: { path: string; body: Record<string, unknown> }[]; passwordUpdates: Record<string, unknown>[]; failNextCheckpoint: boolean; down: boolean }
export interface MockOptions { ai?: 'ok' | 'fail' | 'unreadable'; seedLots?: boolean; realOrg?: boolean; emptyMaster?: boolean; disabledLogin?: boolean; tempPassword?: boolean; sessionSeconds?: number }

export async function mockBackend(page: Page, opts: MockOptions = {}): Promise<Recorded> {
  const rec: Recorded = { checkpoints: [], lots: [], farmers: [], uploads: [], uploadAttempts: [], order: [], functionCalls: [], staffCalls: [], inserts: [], patches: [], passwordUpdates: [], failNextCheckpoint: false, down: false };
  let persona: 'agent' | 'manager' = 'agent'; let tempFlag = opts.tempPassword === true; const seen = new Set<string>();
  const insights: Record<string, unknown>[] = []; let alerts = [
    { id: 'al1', lot_id: 'lot-1043', severity: 'critical', rule: 'A2_wait_exceeded', message_en: 'Lot T-1043 has waited 3.4 h at 35°C at Centre B. Dispatch now.', message_te: 'లాట్ T-1043 వేచి ఉంది. ఇప్పుడే పంపండి.', created_at: '2026-10-20T10:00:00Z', acknowledged_at: null, lot: { short_code: 'T-1043' } },
    { id: 'al2', lot_id: 'lot-1044', severity: 'warn', rule: 'A1_wait_warning', message_en: 'Lot T-1044 has waited 2.4 h at Centre B (limit 3 h). Plan dispatch.', message_te: null, created_at: '2026-10-20T10:05:00Z', acknowledged_at: null, lot: { short_code: 'T-1044' } }];
  const team: Record<string, unknown>[] = [{ user_id: MANAGER, name: 'Demo Manager', role: 'manager', email: 'manager@staff.test', phone: null, disabled: false }, { user_id: AGENT, name: 'Ravi Kumar', role: 'field_agent', email: 'ravi@staff.test', phone: null, disabled: false }];
  const lotsByCode: Record<string, Record<string, unknown>> = {}; const cps: Record<string, unknown>[] = [];
  const userOf = (uid: string, email?: string) => ({ id: uid, aud: 'authenticated', email: email ?? 'x', user_metadata: tempFlag ? { temp_password: true } : {} });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  const noContent = (route: Route) => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

  await page.route('http://localhost:54321/**', async (route) => {
    if (rec.down) return route.abort('connectionfailed');
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const uid = () => (persona === 'manager' ? MANAGER : AGENT);
    if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') return json(route, { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r2', user: userOf(uid()) });
    if (p === '/auth/v1/token') {
      const b = req.postDataJSON() as { password?: string; email?: string };
      if (b.password !== 'LossMap-Demo-2026') return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      persona = b.email?.startsWith('manager') ? 'manager' : 'agent';
      const nowS = Math.floor(Date.now() / 1000), short = opts.sessionSeconds;
      return json(route, { access_token: jwt, token_type: 'bearer', expires_in: short ?? 3600, expires_at: short ? nowS + short : 4102444800, refresh_token: 'r', user: userOf(uid(), b.email) });
    }
    if (p === '/auth/v1/logout') return noContent(route);
    if (p === '/auth/v1/user' && method === 'PUT') {
      const b = req.postDataJSON() as { password?: string; data?: { temp_password?: boolean } }; rec.passwordUpdates.push(b as Record<string, unknown>);
      if (b.password === 'Same-Password-1') return json(route, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }, 422);
      if (b.data?.temp_password === false) tempFlag = false;
      return json(route, userOf(uid()));
    }
    if (p === '/rest/v1/profiles' && url.searchParams.get('user_id')) {
      if (opts.disabledLogin) return json(route, []); // row-level security hides a disabled person's profile: zero rows, no error
      return json(route, [{ user_id: uid(), org_id: ORG, role: persona === 'manager' ? 'manager' : 'field_agent', name: persona === 'manager' ? 'Demo Manager' : 'Demo Agent', language: 'en', organizations: { name: 'Demo Tomato Processor', is_demo: !opts.realOrg } }]);
    }
    if (p === '/rest/v1/profiles') return method === 'PATCH' ? noContent(route) : json(route, team);
    if (method === 'PATCH') { rec.patches.push({ path: p, body: req.postDataJSON() as Record<string, unknown> }); if (p === '/rest/v1/alerts') alerts = alerts.map((a) => (url.searchParams.get('id') === `eq.${a.id}` ? { ...a, acknowledged_at: new Date().toISOString() } : a)); return noContent(route); }
    const rpc: Record<string, unknown> = { dashboard_kpis: managerData.kpis, stage_loss: managerData.stages, centre_loss: managerData.centres, transporter_loss: managerData.transporters, time_of_day_loss: managerData.hours, telegram_status: false, create_telegram_link: 'abcdef0123456789abcdef0123456789' };
    if (p.startsWith('/rest/v1/rpc/') && p.slice(13) in rpc) return json(route, rpc[p.slice(13)]);
    if (p === '/rest/v1/rpc/get_public_lot_report') return json(route, (req.postDataJSON() as { p_token: string }).p_token.length >= 32 ? [{ short_code: 'T-1043', crop_name: 'Tomato', crop_name_te: 'టమాటా', farmer_name: 'Venkata Ramana', village: 'Ramasamudram', recorded_at: '2026-10-10T02:30:00Z', weight_kg: 250, quality_good_pct: 90, quality_damaged_pct: 8, quality_rotten_pct: 2, quality_is_ai: false, org_name: 'Demo Tomato Processor (Simulated)', is_demo: true }] : []);
    if (p === '/rest/v1/lot_segments') return json(route, segments);
    if (p === '/rest/v1/alerts') return json(route, alerts);
    if (p === '/rest/v1/insights') return json(route, insights.slice(0, 1));
    if (p === '/rest/v1/audit_log') return json(route, [{ row_id: 'cp2', field: 'weight_kg', old_value: '240.00', new_value: '245.00', changed_at: '2026-10-10T09:00:00Z' }]);
    if (p === '/rest/v1/farmers' && method === 'POST') { rec.farmers.push(req.postDataJSON() as Record<string, unknown>); rec.order.push('farmer'); return json(route, [], 201); }
    if (p === '/rest/v1/farmers') return json(route, [...fixtures.farmers, ...rec.farmers.filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i).map((f) => ({ id: f.id, name: f.name, village: f.village }))]);
    if (method === 'POST' && (p === '/rest/v1/crops' || p === '/rest/v1/centres')) { rec.inserts.push({ path: p, body: req.postDataJSON() as Record<string, unknown> }); return json(route, [], 201); }
    if (p === '/rest/v1/crops') return json(route, opts.emptyMaster ? [] : fixtures.crops);
    if (p === '/rest/v1/centres') return json(route, opts.emptyMaster ? [] : fixtures.centres);
    if (p === '/rest/v1/transporters') return json(route, fixtures.transporters);
    if (p === '/rest/v1/lots' && method === 'POST') { const row = req.postDataJSON() as { short_code: string }; rec.lots.push(row); rec.order.push('lot'); lotsByCode[row.short_code] = { ...row, status: 'open', created_at: new Date().toISOString(), farmer: fixtures.farmers[0], crop: fixtures.crops[0] }; return json(route, [], 201); }
    if (p === '/rest/v1/lots') {
      const id = url.searchParams.get('id'), code = (url.searchParams.get('short_code') ?? '').replace('eq.', '');
      if (id === 'eq.lot-1043' && (url.searchParams.get('select') ?? '') === 'public_token') return json(route, [{ public_token: 'a'.repeat(64) }]);
      const t1043 = { id: 'lot-1043', short_code: 'T-1043', qr_code: 'T-1043', crate_count: 12, status: 'delivered', created_at: '2026-10-10T02:30:00Z', farmer: { id: 'f9', name: 'Venkata Ramana', village: 'Ramasamudram' }, crop: fixtures.crops[0] };
      if (code === 'T-1043' || id === 'eq.lot-1043') return json(route, [t1043]);
      if (code) return json(route, lotsByCode[code] ? [lotsByCode[code]] : []);
      const base = { status: 'delivered', created_at: '2026-10-10T02:30:00Z', crop: { name: 'Tomato' } };
      return json(route, opts.seedLots ? [{ ...base, id: 'lot-1043', short_code: 'T-1043', farmer: { name: 'Venkata Ramana', village: 'Ramasamudram' } }, { ...base, id: 'lot-1044', short_code: 'T-1044', status: 'open', farmer: { name: 'Lakshmi Devi', village: 'Thamballapalle' } }] : Object.values(lotsByCode));
    }
    if (p.startsWith('/functions/v1/')) {
      const fn = p.replace('/functions/v1/', ''); rec.functionCalls.push(fn);
      if (fn === 'weather-exposure') return json(route, { result: 'stored' });
      if (fn === 'insights-summary') { insights.unshift({ week_start: '2026-10-19', text_en: 'Centre B lost ₹33,980 (11.3%). Waiting at the centre is the biggest loss.', text_te: 'సెంటర్ B లో ₹33,980 నష్టం.', recommendation: JSON.stringify({ en: 'Dispatch Centre B lots sooner.', te: 'సెంటర్ B లాట్లను త్వరగా పంపండి.' }), numbers: { source: 'template' }, created_at: new Date().toISOString() }); return json(route, { ok: true }); }
      if (fn === 'demo-seed') return json(route, { ok: true, action: (req.postDataJSON() as { action: string }).action, lots: 114 });
      if (fn === 'public-photo') return json(route, { url: '/storage/v1/object/sign-img/x.jpg' });
      if (fn === 'staff') {
        const b = req.postDataJSON() as { action: string; userId?: string; active?: boolean; name?: string; email?: string; role?: string; phone?: string }; rec.staffCalls.push(b);
        if (b.action === 'create') { if (team.some((m) => m.email === b.email?.trim().toLowerCase())) return json(route, { ok: false, code: 'email_taken' }, 409); const id = `new-${team.length}`; team.push({ user_id: id, name: b.name, role: b.role, email: b.email?.trim().toLowerCase(), phone: b.phone || null, disabled: false }); return json(route, { ok: true, userId: id, tempPassword: 'Xk7mQ2vRp9Tz' }); }
        if (b.action === 'reset_password') return json(route, { ok: true, tempPassword: 'Ab3dEf6Hj8Kn' });
        if (b.action === 'set_active') { const m = team.find((x) => x.user_id === b.userId); if (m) m.disabled = !b.active; return json(route, { ok: true, active: b.active, sessionsRevoked: true }); }
        return json(route, { ok: false, code: 'invalid' }, 400);
      }
      if (!opts.ai || opts.ai === 'fail') return json(route, { ok: false, reason: 'unavailable' });
      if (fn === 'ai-read-scale') return json(route, opts.ai === 'unreadable' ? { ok: true, cached: false, result: { weightKg: null, rawValue: null, unit: null, confidence: 0.2, readable: false, needsManual: true } } : { ok: true, cached: false, result: { weightKg: 250, rawValue: 250, unit: 'kg', confidence: 0.93, readable: true, needsManual: false } });
      if (fn === 'ai-quality') return json(route, { ok: true, cached: false, result: { goodPct: 72.5, damagedPct: 20, rottenPct: 7.5, defects: ['bruising'], confidence: 0.64, notes: '' } });
    }
    if (p === '/rest/v1/checkpoints' && method === 'POST') {
      if (rec.failNextCheckpoint) { rec.failNextCheckpoint = false; return route.abort('connectionfailed'); }
      const row = req.postDataJSON() as Record<string, unknown>; rec.checkpoints.push(row); rec.order.push('checkpoint'); cps.push({ ...row, flags: [], offline_synced: false }); return json(route, [], 201);
    }
    if (p === '/rest/v1/checkpoints') return json(route, url.searchParams.get('lot_id') === 'eq.lot-1043' ? seeded : cps.filter((c) => `eq.${c.lot_id}` === url.searchParams.get('lot_id')));
    if (p.startsWith('/storage/v1/object/sign/')) return json(route, { signedURL: '/storage/v1/object/sign-img/x.jpg' });
    if (p.startsWith('/storage/v1/object/photos/')) {
      const path = decodeURIComponent(p.replace('/storage/v1/object/photos/', '')); rec.uploadAttempts.push(path);
      if (seen.has(path)) return json(route, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, 400); // like real storage without an UPDATE policy
      seen.add(path); rec.uploads.push(path); return json(route, { Key: p });
    }
    if (p.includes('sign-img')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    return json(route, { message: `unmocked ${method} ${p}` }, 404);
  });
  return rec;
}
