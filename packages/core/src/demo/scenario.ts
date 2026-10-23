// SIMULATED demo scenario: a tomato processor near Madanapalle, three villages, two collection centres, 14 days.
// Generated, not real. The app labels it "Simulated demo data" and the organisation is flagged is_demo in the database.

export interface DemoIds { orgId: string; managerId: string; agentId: string; receiverId: string }
type Row = Record<string, unknown>;
export interface DemoScenario { organization: Row; farmers: Row[]; crops: Row[]; centres: Row[]; transporters: Row[]; lots: Row[]; checkpoints: Row[] }

/** Deterministic PRNG so the story is the same every time it is loaded. */
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const uuid = (kind: number, n: number) => `de${kind.toString(16).padStart(2, '0')}0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const IST = 19_800_000;

export const DEMO_CENTRES = { A: uuid(4, 1), B: uuid(4, 2), F: uuid(4, 3) };
const VILLAGES = [{ name: 'Ramasamudram', farmers: ['Venkata Ramana', 'Lakshmi Devi', 'Subbarayudu', 'Padmavathi'] }, { name: 'Thamballapalle', farmers: ['Narayana Reddy', 'Sarojamma', 'Chengal Reddy', 'Rajeswari'] }, { name: 'Kothapalli', farmers: ['Ravi Kumar', 'Anjaneyulu', 'Gangamma', 'Mohan Rao'] }];
const CROP = uuid(3, 1);

export function generateDemoScenario(o: { now: Date; ids: DemoIds; days?: number; seed?: number }): DemoScenario {
  const rnd = mulberry32(o.seed ?? 2026), between = (a: number, b: number) => a + rnd() * (b - a);
  const days = o.days ?? 14;
  const farmers = VILLAGES.flatMap((v, vi) => v.farmers.map((n, i) => ({ id: uuid(2, vi * 10 + i + 1), org_id: o.ids.orgId, name: n, village: v.name })));
  const crop = { id: CROP, org_id: o.ids.orgId, name: 'Tomato', name_te: 'టమాటా', code_prefix: 'T', price_per_kg: 20, damaged_value_factor: 0.5, heat_threshold_c: 30, max_safe_wait_hours: 3, unit_tolerance_pct: 1 };
  const centres = [
    { id: DEMO_CENTRES.A, org_id: o.ids.orgId, name: 'Centre A (Madanapalle)', type: 'collection_centre', lat: 13.5503, lng: 78.5029, radius_m: 300, expected_transport_h: 1 },
    { id: DEMO_CENTRES.B, org_id: o.ids.orgId, name: 'Centre B (Punganur)', type: 'collection_centre', lat: 13.3667, lng: 78.57, radius_m: 300, expected_transport_h: 1.8 },
    { id: DEMO_CENTRES.F, org_id: o.ids.orgId, name: 'Factory (Chittoor)', type: 'factory', lat: 13.2172, lng: 79.1003, radius_m: 500, expected_transport_h: null },
  ];
  const transporters = [{ id: uuid(5, 1), org_id: o.ids.orgId, name: 'Sri Venkateswara Transport', vehicle_no: 'AP03 TX 1042' }, { id: uuid(5, 2), org_id: o.ids.orgId, name: 'Balaji Logistics', vehicle_no: 'AP03 TY 7781' }];
  const lots: Row[] = [], cps: Row[] = [];
  const startDay = Date.UTC(o.now.getUTCFullYear(), o.now.getUTCMonth(), o.now.getUTCDate()) - days * 86_400_000;
  let n = 0, cpN = 0;
  const cp = (lotId: string, stage: string, at: number, w: number, q: [number, number, number], centre: string | null, extra: Row = {}) => cps.push({
    id: uuid(7, ++cpN), org_id: o.ids.orgId, lot_id: lotId, stage, centre_id: centre, weight_kg: Math.round(w * 10) / 10, weight_source: 'manual', crate_count: 12,
    quality_good_pct: q[0], quality_damaged_pct: q[1], quality_rotten_pct: q[2], capture_method: 'camera',
    lat: centre ? centres.find((c) => c.id === centre)!.lat : 13.5, lng: centre ? centres.find((c) => c.id === centre)!.lng : 78.4, device_captured_at: new Date(at).toISOString(), recorded_by: o.ids.agentId, ...extra });

  for (let d = 0; d < days; d++) {
    for (let i = 0; i < 8; i++) {
      const village = VILLAGES[Math.floor(rnd() * 3)]!, farmer = farmers.find((f) => f.village === village.name && rnd() < 0.5) ?? farmers[0]!;
      const toB = rnd() < 0.5, centre = toB ? DEMO_CENTRES.B : DEMO_CENTRES.A;
      // arrival hour (IST): Centre B keeps lots into the hot afternoon; Centre A mostly receives in the morning
      const hourIst = toB ? between(7, 16) : (rnd() < 0.9 ? between(7, 10.5) : between(12, 14));
      const arrive = startDay + d * 86_400_000 + hourIst * 3_600_000 - IST;
      const pickup = arrive - between(0.8, 1.6) * 3_600_000;
      const hot = hourIst >= 11.5 && hourIst <= 16;
      const wait = toB ? (hot ? between(3.4, 5) : between(1.5, 2.8)) : (hot ? between(2, 2.8) : between(1, 1.8));
      const depart = arrive + wait * 3_600_000;
      const transport = between(1.5, 2.2);
      const w0 = between(150, 400), w1 = w0 * (1 - between(0.003, 0.01)), w2 = w1 * (1 - wait * between(0.002, 0.004) * (hot ? 2 : 1)), w3 = w2 * (1 - between(0.003, 0.008));
      const good0 = 90 - between(0, 3), dmg0 = 8 - between(0, 2), q0: [number, number, number] = [good0, dmg0, 100 - good0 - dmg0];
      const drop = wait * (hot ? between(2.9, 4.4) : between(0.3, 0.6)), good2 = good0 - drop, dmg2 = dmg0 + drop * 0.6, q2: [number, number, number] = [good2, dmg2, 100 - good2 - dmg2];
      const good3 = good2 - between(1, 3), q3: [number, number, number] = [good3, dmg2 + 1.5, 100 - good3 - dmg2 - 1.5];
      const lotId = uuid(6, ++n), code = `T-${String(1000 + n)}`;
      const round = (q: [number, number, number]): [number, number, number] => { const a = Math.round(q[0] * 10) / 10, b = Math.round(q[1] * 10) / 10; return [a, b, Math.round((100 - a - b) * 10) / 10]; };
      lots.push({ id: lotId, org_id: o.ids.orgId, short_code: code, qr_code: code, farmer_id: farmer.id, crop_id: CROP, crate_count: 12, status: 'delivered', created_by: o.ids.agentId, created_at: new Date(pickup).toISOString() });
      cp(lotId, 'farm_pickup', pickup, w0, round(q0), null);
      cp(lotId, 'centre_arrival', arrive, w1, round(q0), centre);
      cp(lotId, 'centre_dispatch', depart, w2, round(q2), centre);
      cp(lotId, 'factory_arrival', depart + transport * 3_600_000, w3, round(q3), DEMO_CENTRES.F, { transporter_id: rnd() < 0.5 ? transporters[0]!.id : transporters[1]!.id });
    }
  }
  // two lots still waiting at Centre B right now, so the alert rules have something real to fire on
  for (const [k, waitedH] of [[1, 3.4], [2, 2.4]] as const) {
    const lotId = uuid(6, ++n), code = `T-${String(1000 + n)}`, arrive = o.now.getTime() - waitedH * 3_600_000, pickup = arrive - 3_600_000 * 1.2;
    lots.push({ id: lotId, org_id: o.ids.orgId, short_code: code, qr_code: code, farmer_id: farmers[k]!.id, crop_id: CROP, crate_count: 12, status: 'open', created_by: o.ids.agentId, created_at: new Date(pickup).toISOString() });
    cp(lotId, 'farm_pickup', pickup, 280, [90, 8, 2], null); cp(lotId, 'centre_arrival', arrive, 277, [90, 8, 2], DEMO_CENTRES.B);
  }
  return { organization: { id: o.ids.orgId, name: 'Demo Tomato Processor', type: 'processor', is_demo: true }, farmers, crops: [crop], centres, transporters, lots, checkpoints: cps };
}
