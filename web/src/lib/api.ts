import { isLotId } from './lotCode.ts';
import { supabase } from './supabase.ts';
import type { Centre, Checkpoint, Crop, Farmer, Lot, Transporter } from './db.ts';
import { Rejected, type Remote } from './offline/sync.ts';

export interface MasterData { farmers: Farmer[]; crops: Crop[]; centres: Centre[]; transporters: Transporter[] }
function check<T>(res: { data: T | null; error: { message: string } | null }): T { if (res.error) throw new Error(res.error.message); return res.data as T; }

export async function loadMaster(): Promise<MasterData> {
  const [farmers, crops, centres, transporters] = await Promise.all([
    supabase.from('farmers').select('id, name, village').order('name'),
    supabase.from('crops').select('id, name, name_te, code_prefix, price_per_kg, heat_threshold_c, max_safe_wait_hours, damaged_value_factor, unit_tolerance_pct').order('name'),
    supabase.from('centres').select('id, name, type, lat, lng, radius_m, expected_transport_h').order('name'),
    supabase.from('transporters').select('id, name, vehicle_no').order('name'),
  ]);
  return { farmers: check(farmers) as Farmer[], crops: check(crops) as Crop[], centres: check(centres) as Centre[], transporters: check(transporters) as Transporter[] };
}

/** A server rejection (constraint, permission) is permanent for that item; a dropped connection is not. */
const guard = (error: { message: string; code?: string } | null) => { if (error) throw (error.code || /violates|policy|permission/i.test(error.message) ? new Rejected(error.message) : new Error(error.message)); };

export const remote: Remote = {
  async saveFarmer(row) { guard((await supabase.from('farmers').upsert(row, { onConflict: 'id', ignoreDuplicates: true })).error); },
  async saveLot(row) { guard((await supabase.from('lots').upsert(row, { onConflict: 'id', ignoreDuplicates: true })).error); },
  async saveCheckpoint(row) { guard((await supabase.from('checkpoints').upsert(row, { onConflict: 'id', ignoreDuplicates: true })).error); },
  async uploadPhoto(path, blob) {
    // no upsert: replacing evidence would need an UPDATE policy. A repeat upload of the same path means it already arrived.
    const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error && String((error as { statusCode?: string }).statusCode) !== '409' && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
  },
  async enrich(id) { await supabase.functions.invoke('weather-exposure', { body: { checkpoint_id: id } }); },
};

export const signedPhotoUrl = async (path: string) => (await supabase.storage.from('photos').createSignedUrl(path, 3600)).data?.signedUrl ?? null;

const LOT_SELECT = 'id, short_code, qr_code, crate_count, status, created_at, farmer:farmers(id, name, village), crop:crops(id, name, name_te, code_prefix, price_per_kg, heat_threshold_c, max_safe_wait_hours, damaged_value_factor, unit_tolerance_pct)';
/** `codeOrId` is the short code people type, or the lot id carried by the QR label (which can never collide). */
export async function fetchLotByCode(codeOrId: string): Promise<Lot | null> {
  const q = supabase.from('lots').select(LOT_SELECT);
  const { data } = await (isLotId(codeOrId) ? q.eq('id', codeOrId) : q.eq('short_code', codeOrId.toUpperCase())).maybeSingle();
  return (data as unknown as Lot) ?? null;
}
export async function fetchCheckpoints(lotId: string): Promise<Checkpoint[]> {
  return check(await supabase.from('checkpoints').select('id, lot_id, stage, centre_id, weight_kg, weight_source, crate_count, quality_good_pct, quality_damaged_pct, quality_rotten_pct, scale_photo_url, produce_photo_url, device_captured_at, flags, offline_synced').eq('lot_id', lotId).order('device_captured_at')) as Checkpoint[];
}
export async function fetchRecentLots(limit = 200): Promise<Lot[]> {
  return check(await supabase.from('lots').select(LOT_SELECT).order('created_at', { ascending: false }).limit(limit)) as unknown as Lot[];
}
