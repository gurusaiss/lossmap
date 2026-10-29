import { supabase } from '../supabase.ts';

export interface Kpis { total_loss_rs: number; value_in: number; loss_pct: number; lots: number; open_alerts: number; worst_centre_id: string | null; worst_centre_name: string | null; worst_centre_loss_rs: number | null }
export interface StageRow { kind: string; segments: number; lots: number; weight_loss_kg: number; weight_loss_rs: number; quality_loss_rs: number; total_loss_rs: number; value_in: number; loss_pct: number }
export interface CentreRow { centre_id: string; centre_name: string; lots: number; total_loss_rs: number; waiting_loss_rs: number; avg_wait_h: number; value_in: number; loss_pct: number }
export interface TransporterRow { transporter_id: string; transporter_name: string; vehicle_no: string | null; trips: number; total_loss_rs: number; avg_transport_h: number; value_in: number; loss_pct: number }
export interface HourRow { arrival_hour: number; segments: number; avg_wait_h: number; avg_heat_hours: number; total_loss_rs: number; value_in: number; loss_pct: number }
export interface Segment {
  lot_id: string; lot_code: string; seg_index: number; from_stage: string; to_stage: string; kind: string; centre_id: string | null; transporter_id: string | null; started_at: string; ended_at: string; duration_h: number;
  weight_from_kg: number; weight_to_kg: number; weight_loss_rs: number; quality_loss_rs: number; total_loss_rs: number; loss_pct: number; measurement_variance: boolean;
  heat_hours: number | null; avg_temp_c: number | null; max_temp_c: number | null; exposure_status: string | null; cause_rule: string; to_checkpoint_id: string;
}
export interface AlertRow { id: string; lot_id: string; severity: 'warn' | 'critical'; rule: string; message_en: string; message_te: string | null; created_at: string; acknowledged_at: string | null; lot: { short_code: string } | null }
export interface InsightRow { week_start: string; text_en: string; text_te: string | null; recommendation: string | null; numbers: { source?: string } }

async function rpc<T>(fn: string, days: number | null): Promise<T[]> {
  const p_from = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  const { data, error } = await supabase.rpc(fn, { p_from });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}
export async function loadOverview(days: number | null) {
  const [k, stages, centres, transporters, hours] = await Promise.all([rpc<Kpis>('dashboard_kpis', days), rpc<StageRow>('stage_loss', days), rpc<CentreRow>('centre_loss', days), rpc<TransporterRow>('transporter_loss', days), rpc<HourRow>('time_of_day_loss', days)]);
  return { kpis: k[0] ?? null, stages, centres, transporters, hours };
}
export async function loadSegments(filter: { kind?: string; centreId?: string; transporterId?: string; hour?: number; lotId?: string }): Promise<Segment[]> {
  let q = supabase.from('lot_segments').select('*').order('total_loss_rs', { ascending: false }).limit(200);
  if (filter.kind) q = q.eq('kind', filter.kind);
  if (filter.centreId) q = q.eq('centre_id', filter.centreId);
  if (filter.transporterId) q = q.eq('transporter_id', filter.transporterId);
  if (filter.lotId) q = q.eq('lot_id', filter.lotId).order('seg_index');
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Segment[];
  if (filter.hour !== undefined) rows = rows.filter((s) => s.kind === 'waiting' && (new Date(Date.parse(s.started_at) + 19_800_000).getUTCHours()) === filter.hour);
  return rows;
}
export async function loadAlerts(): Promise<AlertRow[]> {
  const { data, error } = await supabase.from('alerts').select('id, lot_id, severity, rule, message_en, message_te, created_at, acknowledged_at, lot:lots(short_code)').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AlertRow[];
}
export const acknowledgeAlert = (id: string) => supabase.from('alerts').update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
export async function latestInsight(): Promise<InsightRow | null> { const { data } = await supabase.from('insights').select('week_start, text_en, text_te, recommendation, numbers').order('created_at', { ascending: false }).limit(1).maybeSingle(); return (data as InsightRow | null) ?? null; }
export const generateInsight = () => supabase.functions.invoke('insights-summary', { body: { days: 14 } });
export async function demoAction(action: 'load' | 'reset'): Promise<{ ok: boolean }> { const { data, error } = await supabase.functions.invoke('demo-seed', { body: { action } }); return error ? { ok: false } : (data as { ok: boolean }); }
export async function createTelegramLink(): Promise<string> { const r = await supabase.rpc('create_telegram_link'); if (r.error) throw new Error(r.error.message); return String(r.data); }
export async function telegramConnected(): Promise<boolean> { return (await supabase.rpc('telegram_status')).data === true; }
