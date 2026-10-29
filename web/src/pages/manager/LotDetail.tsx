import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { explainRule, type CauseRule } from '@lossmap/core';
import { ManagerShell } from '../../components/manager/ManagerShell.tsx';
import { Timeline, type TimelineItem } from '../../components/Timeline.tsx';
import { fetchCheckpoints, fetchLotByCode } from '../../lib/api.ts';
import { loadSegments, type Segment } from '../../lib/manager/analytics.ts';
import { hoursLabel, inr, pct } from '../../lib/manager/format.ts';
import { loadMasterCached } from '../../lib/master.ts';
import { supabase } from '../../lib/supabase.ts';
import type { Centre, Lot } from '../../lib/db.ts';

const Waterfall = lazy(() => import('../../components/manager/Charts.tsx').then((m) => ({ default: m.Waterfall })));
interface Audit { row_id: string; field: string; old_value: string | null; new_value: string | null; changed_at: string }

export default function LotDetail() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const [lot, setLot] = useState<(Lot & { public_token?: string }) | null | undefined>(undefined);
  const [segs, setSegs] = useState<Segment[]>([]); const [cps, setCps] = useState<TimelineItem[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]); const [audit, setAudit] = useState<Audit[]>([]);
  const [edit, setEdit] = useState<{ id: string; v: string } | null>(null); const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    const l = await fetchLotByCode(decodeURIComponent(code)); setLot(l); if (!l) return;
    const [s, c, a, tok] = await Promise.all([loadSegments({ lotId: l.id }), fetchCheckpoints(l.id), supabase.from('audit_log').select('row_id, field, old_value, new_value, changed_at').order('changed_at'), supabase.from('lots').select('public_token').eq('id', l.id).maybeSingle()]);
    setSegs(s); setCps(c); setAudit((a.data ?? []) as Audit[]); setLot({ ...l, public_token: (tok.data as { public_token: string } | null)?.public_token });
  }, [code]);
  useEffect(() => { void load(); void loadMasterCached().then((m) => setCentres(m?.centres ?? [])); }, [load]);
  async function saveWeight() {
    if (!edit) return; const w = Number(edit.v);
    if (!Number.isFinite(w) || w <= 0) return;
    await supabase.from('checkpoints').update({ weight_kg: w }).eq('id', edit.id); setEdit(null); await load();
  }
  if (lot === undefined) return <ManagerShell><p className="text-muted">{t('loading')}</p></ManagerShell>;
  if (lot === null) return <ManagerShell><p role="alert">{t('lotNotFound')}</p></ManagerShell>;
  const total = segs.reduce((a, s) => a + s.total_loss_rs, 0);
  const steps = segs.map((s) => ({ name: t(`stage_${s.kind}`), base: 0, loss: s.total_loss_rs }));
  let run = 0; steps.forEach((s) => { s.base = run; run += s.loss; });
  return (
    <ManagerShell>
      <h1 className="text-2xl font-extrabold">{lot.short_code} <span className="text-base font-normal text-muted">{lot.crop?.name} · {lot.farmer?.name}, {lot.farmer?.village}</span></h1>
      <p className="text-base" data-testid="lot-total">{t('lotTotal')}: <b className="text-figure text-lg">{inr(total)}</b></p>
      {segs.length > 0 && <Suspense fallback={null}><Waterfall steps={steps} label={t('waterfall')} /></Suspense>}
      <ul className="space-y-2" data-testid="segments">
        {segs.map((s) => (
          <li key={s.to_checkpoint_id} className="card card-hover space-y-1" data-testid="segment">
            <div className="flex justify-between gap-2"><b>{t(`stage_${s.kind}`)} · {hoursLabel(s.duration_h)}</b><b>{inr(s.total_loss_rs)} ({pct(s.loss_pct)})</b></div>
            <div className="text-sm text-muted">{s.weight_from_kg} → {s.weight_to_kg} kg · ₹{Math.round(s.weight_loss_rs)} {t('weightPart')} + ₹{Math.round(s.quality_loss_rs)} {t('qualityPart')}</div>
            {s.measurement_variance && <div className="text-sm text-warn">{t('variance')}</div>}
            <div className="text-sm" data-testid="cause"><span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold">{t(`cause_${s.cause_rule}`)}</span> {explainRule(s.cause_rule as CauseRule, { waitedH: s.duration_h, limitH: s.max_safe_wait_hours ?? undefined, heatHours: s.heat_hours ?? 0, transportH: s.duration_h, expectedH: s.expected_transport_h ?? undefined, dropPoints: s.quality_drop_points ?? undefined })}</div>
            {s.exposure_status === 'ok' && <div className="text-xs text-muted" data-testid="weather">{t('weather')}: {s.heat_hours} h {t('aboveThreshold')} · {t('avg')} {s.avg_temp_c}°C · {t('max')} {s.max_temp_c}°C</div>}
            {s.exposure_status === 'unavailable' && <div className="text-xs text-muted">{t('weatherUnavailable')}</div>}
          </li>
        ))}
      </ul>
      <Timeline items={cps} centres={centres} />
      {cps.map((c) => (edit?.id === c.id ? (
        <div key={c.id} className="card flex gap-2"><input className="input" inputMode="decimal" value={edit.v} onChange={(e) => setEdit({ id: c.id, v: e.target.value })} aria-label={t('correctWeight')} /><button className="btn btn-primary !w-auto" onClick={() => void saveWeight()} data-testid="weight-save">{t('save')}</button><button className="btn !w-auto" onClick={() => setEdit(null)}>{t('cancel')}</button></div>
      ) : <button key={c.id} className="mr-2 text-xs underline" onClick={() => setEdit({ id: c.id, v: String(c.weight_kg) })} data-testid="weight-edit">{t('correctWeight')}: {t(`stage_${c.stage}`)}</button>))}
      {audit.filter((a) => cps.some((c) => c.id === a.row_id)).length > 0 && <section className="card text-sm" data-testid="audit"><b>{t('changeLog')}</b>{audit.filter((a) => cps.some((c) => c.id === a.row_id)).map((a) => <div key={a.changed_at}>{a.field}: {a.old_value} → {a.new_value}</div>)}</section>}
      {lot.public_token && <button className="btn" onClick={() => void navigator.clipboard.writeText(`${location.origin}/r/${lot.public_token}`).then(() => setCopied(true))} data-testid="copy-farmer-link">{copied ? t('copied') : t('copyLink')}</button>}
    </ManagerShell>
  );
}
