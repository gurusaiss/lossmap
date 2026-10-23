// Scheduled sweep: find lots still waiting, decide the alert, store it once per wait, and deliver it to Telegram (with retry).
import { evaluateWaiting, sendTelegram, type CropParams } from './core/index.ts';
import type { Db } from './clients.ts';
import { processExposure } from './exposure.ts';

export async function runSweep(db: Db, o: { telegramToken: string; onlyOrg?: string; now?: Date; budgetMs?: number }) {
  const now = o.now ?? new Date();
  const started = Date.now();
  let q = db.from('waiting_lots').select('org_id, lot_id, lot_code, centre_id, arrived_at, crop_id');
  if (o.onlyOrg) q = q.eq('org_id', o.onlyOrg);
  const lots = (await q).data as { org_id: string; lot_id: string; lot_code: string; centre_id: string | null; arrived_at: string; crop_id: string }[] | null ?? [];
  let created = 0;
  for (const l of lots) {
    const crop = (await db.from('crops').select('price_per_kg, damaged_value_factor, heat_threshold_c, max_safe_wait_hours, unit_tolerance_pct').eq('id', l.crop_id).maybeSingle()).data as Record<string, number> | null;
    if (!crop) continue;
    const params: CropParams = { pricePerKg: crop.price_per_kg!, damagedValueFactor: crop.damaged_value_factor!, heatThresholdC: crop.heat_threshold_c!, maxSafeWaitHours: crop.max_safe_wait_hours!, unitTolerancePct: crop.unit_tolerance_pct! };
    const waitedH = (now.getTime() - Date.parse(l.arrived_at)) / 3_600_000;
    const centre = l.centre_id ? (await db.from('centres').select('name').eq('id', l.centre_id).maybeSingle()).data as { name: string } | null : null;
    // temperature only when we really have it: the latest cached hour for the centre's cell, else none
    const d = evaluateWaiting(l.lot_code, centre?.name ?? 'the centre', waitedH, null, params);
    if (!d) continue;
    const key = `${l.lot_id}:${l.arrived_at}:wait:${d.severity}`; // one alert per severity per wait
    const ins = await db.from('alerts').upsert({ org_id: l.org_id, lot_id: l.lot_id, severity: d.severity, rule: d.rule, dedupe_key: key, message_en: d.message, message_te: null }, { onConflict: 'org_id,dedupe_key', ignoreDuplicates: true }).select('id');
    if ((ins.data ?? []).length) created++;
  }
  // deliver anything not yet delivered in the last 24 h (a failed send is retried on the next sweep)
  let delivered = 0;
  if (o.telegramToken) {
    const pending = ((await db.from('alerts').select('id, org_id, message_en').is('notified_at', null).gte('created_at', new Date(now.getTime() - 86_400_000).toISOString()).limit(50)).data ?? []) as { id: string; org_id: string; message_en: string }[];
    for (const a of pending) {
      const org = (await db.from('organizations').select('telegram_chat_id').eq('id', a.org_id).maybeSingle()).data as { telegram_chat_id: number | null } | null;
      if (!org?.telegram_chat_id) continue;
      if (await sendTelegram(fetch, o.telegramToken, org.telegram_chat_id, a.message_en)) { await db.from('alerts').update({ notified_at: now.toISOString() }).eq('id', a.id); delivered++; }
    }
  }
  // then backfill missed weather lookups, time-boxed so the sweep itself is never starved
  let backfilled = 0;
  const missing = ((await db.from('checkpoints_missing_exposure').select('id').limit(20)).data ?? []) as { id: string }[];
  for (const m of missing) {
    if (Date.now() - started > (o.budgetMs ?? 40_000)) break;
    if ((await processExposure(db, m.id)) === 'stored') backfilled++;
  }
  return { lots: lots.length, created, delivered, backfilled };
}
