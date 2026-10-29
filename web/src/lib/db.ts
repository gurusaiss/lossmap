import type { Role, Stage, WeightSource } from '@lossmap/core';

export interface Profile { user_id: string; org_id: string; role: Role; name: string; language: 'en' | 'te' }
export interface Farmer { id: string; name: string; village: string }
export interface Crop { id: string; name: string; name_te: string | null; code_prefix: string; price_per_kg: number; heat_threshold_c: number; max_safe_wait_hours: number; damaged_value_factor?: number; unit_tolerance_pct?: number }
export interface Centre { id: string; name: string; type: 'collection_centre' | 'factory' | 'storage'; lat: number; lng: number; radius_m: number | null; expected_transport_h: number | null }
export interface Transporter { id: string; name: string; vehicle_no: string | null }
export interface Lot { id: string; short_code: string; qr_code: string; crate_count: number | null; status: string; created_at: string; farmer?: Farmer | null; crop?: Crop | null }
export interface Checkpoint {
  id: string; lot_id: string; stage: Stage; centre_id: string | null; weight_kg: number; weight_source: WeightSource; crate_count: number | null;
  quality_good_pct: number | null; quality_damaged_pct: number | null; quality_rotten_pct: number | null;
  scale_photo_url: string | null; produce_photo_url: string | null; device_captured_at: string; flags: string[]; offline_synced: boolean;
}
