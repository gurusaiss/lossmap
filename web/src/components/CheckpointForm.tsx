import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nextStage, type Stage } from '@lossmap/core';
import { useAuth } from '../lib/auth.tsx';
import { db } from '../lib/offline/db.ts';
import { queueCheckpoint } from '../lib/offline/outbox.ts';
import { triggerSync } from '../lib/offline/loop.ts';
import { compress, sha256Hex } from '../lib/image.ts';
import { getPosition } from '../lib/geo.ts';
import { estimateQuality, readScale } from '../lib/ai.ts';
import { QUALITY_PRESETS, type PresetKey } from '../lib/quality.ts';
import type { Centre, Transporter } from '../lib/db.ts';
import { CameraCapture, type CaptureMethod } from './CameraCapture.tsx';

const STAGES: Stage[] = ['farm_pickup', 'centre_arrival', 'centre_dispatch', 'storage_in', 'storage_out', 'factory_arrival'];
const needsCentre = (s: Stage) => s !== 'farm_pickup';
interface Q { good: number; damaged: number; rotten: number; ai: boolean; conf: number | null }

export function CheckpointForm({ lotId, lotLabel, lastStage, centres, transporters, defaultCrates, onSaved }: { lotId: string; lotLabel: string; lastStage: Stage | null; centres: Centre[]; transporters: Transporter[]; defaultCrates?: number | null; onSaved: (checkpointId: string) => void }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>(nextStage(lastStage));
  const [centreId, setCentreId] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [weight, setWeight] = useState('');
  const [crates, setCrates] = useState(defaultCrates ? String(defaultCrates) : '');
  const [aiWeight, setAiWeight] = useState<{ kg: number; conf: number } | null>(null);
  const [hint, setHint] = useState<'reading' | 'unreadable' | 'ai' | null>(null);
  const [scale, setScale] = useState<Blob | null>(null);
  const [produce, setProduce] = useState<Blob | null>(null);
  const [method, setMethod] = useState<CaptureMethod>('camera');
  const [camera, setCamera] = useState<'scale' | 'produce' | null>(null);
  const [q, setQ] = useState<Q | null>(null);
  const [qBusy, setQBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const centreOptions = useMemo(() => centres.filter((c) => (stage === 'factory_arrival' ? c.type === 'factory' : c.type !== 'factory')), [centres, stage]);

  async function onScale(raw: Blob, m: CaptureMethod) {
    setCamera(null); if (m === 'file_input') setMethod('file_input');
    const b = await compress(raw).catch(() => raw); setScale(b); setHint('reading');
    const r = await readScale(b);
    if (r?.weightKg && !r.needsManual) { setAiWeight({ kg: r.weightKg, conf: r.confidence }); setWeight((w) => w || String(r.weightKg)); setHint('ai'); } else setHint('unreadable');
  }
  async function onProduce(raw: Blob, m: CaptureMethod) {
    setCamera(null); if (m === 'file_input') setMethod('file_input');
    const b = await compress(raw).catch(() => raw); setProduce(b); setQBusy(true);
    const r = await estimateQuality(b); setQBusy(false);
    if (r) setQ({ good: r.goodPct, damaged: r.damagedPct, rotten: r.rottenPct, ai: true, conf: r.confidence });
  }
  const preset = (k: PresetKey) => { const [good, damaged, rotten] = QUALITY_PRESETS[k]; setQ({ good, damaged, rotten, ai: false, conf: null }); };

  async function save() {
    const w = Number(weight);
    if (!profile || !Number.isFinite(w) || w <= 0) return setError(t('weightInvalid'));
    if (needsCentre(stage) && !centreId) return setError(t('centreRequired'));
    const c = crates.trim() === '' ? null : Number(crates);
    if (c !== null && (!Number.isInteger(c) || c < 1)) return setError(t('cratesInvalid'));
    setSaving(true); setError(null);
    const id = crypto.randomUUID(); const org = profile.org_id;
    const gps = await getPosition();
    const row = {
      id, org_id: org, lot_id: lotId, stage, centre_id: needsCentre(stage) ? centreId : null, transporter_id: stage === 'factory_arrival' && transporterId ? transporterId : null,
      weight_kg: w, ai_weight_kg: aiWeight?.kg ?? null, ai_confidence: aiWeight?.conf ?? null, crate_count: c,
      quality_good_pct: q?.good ?? null, quality_damaged_pct: q?.damaged ?? null, quality_rotten_pct: q?.rotten ?? null, quality_is_ai: q?.ai ?? false, quality_confidence: q?.conf ?? null,
      scale_photo_url: scale ? `${org}/${id}-scale.jpg` : null, produce_photo_url: produce ? `${org}/${id}-produce.jpg` : null, photo_hash: scale ? await sha256Hex(scale) : null,
      capture_method: method, lat: gps?.lat ?? null, lng: gps?.lng ?? null, gps_accuracy_m: gps?.accuracy ?? null,
      device_captured_at: new Date().toISOString(), offline_synced: !navigator.onLine,
    };
    await queueCheckpoint(db, profile.user_id, { row, scale: scale ?? undefined, produce: produce ?? undefined, scalePath: row.scale_photo_url ?? undefined, producePath: row.produce_photo_url ?? undefined, lotLabel });
    void triggerSync();
    onSaved(id);
  }

  return (
    <div className="space-y-4" data-testid="checkpoint-form">
      <label className="block"><span className="label">{t('stage')}</span>
        <select className="input" value={stage} onChange={(e) => { setStage(e.target.value as Stage); setCentreId(''); }} data-testid="stage-select">{STAGES.map((s) => <option key={s} value={s}>{t(`stage_${s}`)}</option>)}</select></label>
      {needsCentre(stage) && (
        <label className="block"><span className="label">{t('centre')}</span>
          <select className="input" value={centreId} onChange={(e) => setCentreId(e.target.value)} data-testid="centre-select"><option value="">{t('choose')}</option>{centreOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => setCamera('scale')} data-testid="scale-open">{scale ? '✓ ' : ''}{t('scalePhoto')}</button>
        <button className="btn" onClick={() => setCamera('produce')} data-testid="produce-open">{produce ? '✓ ' : ''}{t('producePhoto')}</button>
      </div>
      <label className="block"><span className="label">{t('weightKg')}</span>
        <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} data-testid="weight-input" /></label>
      {hint === 'reading' && <p className="text-sm text-muted" role="status">{t('aiReading')}</p>}
      {hint === 'ai' && aiWeight && <p className="text-sm text-brand-strong" role="status" data-testid="ai-weight-note">{t('aiRead', { kg: aiWeight.kg })}</p>}
      {hint === 'unreadable' && <p className="text-sm text-warn" role="status" data-testid="ai-unreadable">{t('aiUnreadable')}</p>}
      {stage === 'factory_arrival' && transporters.length > 0 && (
        <label className="block"><span className="label">{t('transporter')}</span>
          <select className="input" value={transporterId} onChange={(e) => setTransporterId(e.target.value)}><option value="">{t('choose')}</option>{transporters.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      )}
      <label className="block"><span className="label">{t('crates')}</span><input className="input" inputMode="numeric" value={crates} onChange={(e) => setCrates(e.target.value)} /></label>
      <div className="card space-y-2">
        <div className="font-semibold">{t('qualityTitle')}</div>
        {qBusy && <p className="text-sm text-muted" role="status">{t('aiReading')}</p>}
        {q && (
          <p data-testid={q.ai ? 'quality-ai' : 'quality-manual'} className="text-sm">
            {q.ai ? `${t('qualityAi')}: ` : ''}{t('good')} {q.good}% · {t('damaged')} {q.damaged}% · {t('rotten')} {q.rotten}%{q.conf !== null ? ` · ${t('confidence')} ${Math.round(q.conf * 100)}%` : ''}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">{(Object.keys(QUALITY_PRESETS) as PresetKey[]).map((k) => <button key={k} className="btn !min-h-11 text-sm" onClick={() => preset(k)} data-testid={`preset-${k}`}>{t(`preset_${k}`)}</button>)}</div>
        <p className="text-xs text-muted">{t('qualityNote')}</p>
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button className="btn btn-primary" onClick={() => void save()} disabled={saving} data-testid="save-checkpoint">{saving ? t('saving') : t('save')}</button>
      {camera === 'scale' && <CameraCapture testPrefix="scale" onCancel={() => setCamera(null)} onCapture={(b, m) => void onScale(b, m)} />}
      {camera === 'produce' && <CameraCapture testPrefix="produce" onCancel={() => setCamera(null)} onCapture={(b, m) => void onProduce(b, m)} />}
    </div>
  );
}
