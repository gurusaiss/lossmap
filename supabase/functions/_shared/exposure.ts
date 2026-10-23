// Attach heat exposure to the segment that ends at a checkpoint. Transient failures are not stored (they are retried);
// "no data for that window" is stored as unavailable. A temperature is never invented.
import { cellOf, computeExposure, fetchHourly, WeatherWindowError } from './core/index.ts';
import type { Db } from './clients.ts';

export type ExposureResult = 'stored' | 'no_previous' | 'not_found' | 'weather_failed';
const iso = (ms: number) => new Date(ms).toISOString();

async function hourlyFor(db: Db, lat: number, lng: number, startMs: number, endMs: number, f: typeof fetch): Promise<Map<string, number>> {
  const cell = cellOf(lat, lng);
  const days: string[] = [];
  for (let t = Math.floor(startMs / 86_400_000) * 86_400_000; t < endMs; t += 86_400_000) days.push(iso(t).slice(0, 10));
  const cached = await db.from('weather_cache').select('day, temps_c').eq('cell', cell).in('day', days);
  const have = new Map<string, number[]>((cached.data ?? []).map((r: { day: string; temps_c: number[] }) => [r.day, r.temps_c]));
  let map = new Map<string, number>();
  if (days.every((d) => have.has(d))) {
    for (const [d, arr] of have) arr.forEach((v, h) => { if (typeof v === 'number') map.set(`${d}T${String(h).padStart(2, '0')}`, v); });
    return map;
  }
  map = await fetchHourly(f, lat, lng, startMs, endMs);
  // cache every completed day of the response, so neighbouring lots do not call the API again
  const today = iso(Date.now()).slice(0, 10), byDay = new Map<string, (number | null)[]>();
  for (const [k, v] of map) { const d = k.slice(0, 10), h = Number(k.slice(11, 13)); const a = byDay.get(d) ?? Array(24).fill(null); a[h] = v; byDay.set(d, a); }
  const rows = [...byDay].filter(([d, a]) => d < today && a.every((x) => x !== null)).map(([day, temps_c]) => ({ cell, day, temps_c }));
  if (rows.length) await db.from('weather_cache').upsert(rows, { onConflict: 'cell,day' });
  return map;
}

export async function processExposure(db: Db, checkpointId: string, f: typeof fetch = fetch): Promise<ExposureResult> {
  const cp = await db.from('checkpoints').select('id, org_id, lot_id, lat, lng, device_captured_at, centre_id, centres(lat, lng)').eq('id', checkpointId).maybeSingle();
  if (!cp.data) return 'not_found';
  const c = cp.data as unknown as { id: string; org_id: string; lot_id: string; lat: number | null; lng: number | null; device_captured_at: string; centre_id: string | null; centres: { lat: number; lng: number } | null };
  const prev = await db.from('checkpoints').select('id, lat, lng, device_captured_at').eq('lot_id', c.lot_id).lt('device_captured_at', c.device_captured_at).order('device_captured_at', { ascending: false }).limit(1);
  const p = (prev.data ?? [])[0] as { id: string; lat: number | null; lng: number | null; device_captured_at: string } | undefined;
  if (!p) return 'no_previous';
  const lot = await db.from('lots').select('crop_id, crops(heat_threshold_c)').eq('id', c.lot_id).maybeSingle();
  const threshold = Number((lot.data as unknown as { crops: { heat_threshold_c: number } | null } | null)?.crops?.heat_threshold_c ?? 30);
  const lat = c.centres?.lat ?? c.lat ?? p.lat, lng = c.centres?.lng ?? c.lng ?? p.lng;
  const row = { to_checkpoint_id: c.id, from_checkpoint_id: p.id, org_id: c.org_id };
  const unavailable = async () => { await db.from('segment_exposure').upsert({ ...row, status: 'unavailable', heat_hours: null, avg_temp_c: null, max_temp_c: null }, { onConflict: 'to_checkpoint_id' }); return 'stored' as const; };
  if (lat == null || lng == null) return unavailable();
  const start = Date.parse(p.device_captured_at), end = Date.parse(c.device_captured_at);
  try {
    const hourly = await hourlyFor(db, lat, lng, start, end, f);
    const e = computeExposure(hourly, start, end, threshold);
    if (!e) return unavailable();
    await db.from('segment_exposure').upsert({ ...row, status: 'ok', heat_hours: e.heatHours, avg_temp_c: e.avgTempC, max_temp_c: e.maxTempC, computed_at: iso(Date.now()) }, { onConflict: 'to_checkpoint_id' });
    return 'stored';
  } catch (e) {
    return e instanceof WeatherWindowError ? unavailable() : 'weather_failed';
  }
}
