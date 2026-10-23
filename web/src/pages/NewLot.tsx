import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { Shell } from '../components/Shell.tsx';
import { CheckpointForm } from '../components/CheckpointForm.tsx';
import { QrCard } from '../components/QrCard.tsx';
import { useMaster } from '../lib/master.ts';
import { db } from '../lib/offline/db.ts';
import { queueFarmer, queueLot } from '../lib/offline/outbox.ts';
import { newShortCode } from '../lib/lotCode.ts';
import type { Farmer } from '../lib/db.ts';

export default function NewLot() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { master, failed, setMaster } = useMaster();
  const [step, setStep] = useState<'details' | 'checkpoint' | 'done'>('details');
  const [farmerId, setFarmerId] = useState(''); const [cropId, setCropId] = useState(''); const [crates, setCrates] = useState('');
  const [adding, setAdding] = useState(false); const [nf, setNf] = useState({ name: '', village: '' });
  const [lot, setLot] = useState<{ id: string; code: string; crop: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function addFarmer() {
    if (!profile || !nf.name.trim() || !nf.village.trim() || !master) return;
    const f: Farmer = { id: crypto.randomUUID(), name: nf.name.trim(), village: nf.village.trim() };
    await queueFarmer(db, profile.user_id, { ...f, org_id: profile.org_id }); // queued ahead of the lot, works with no signal
    setMaster({ ...master, farmers: [...master.farmers, f] }); setFarmerId(f.id); setAdding(false); setNf({ name: '', village: '' });
  }
  async function next() {
    const c = crates.trim() === '' ? null : Number(crates);
    if (!farmerId || !cropId) return setErr(t('chooseFarmerCrop'));
    if (c !== null && (!Number.isInteger(c) || c < 1)) return setErr(t('cratesInvalid'));
    const crop = master!.crops.find((x) => x.id === cropId)!;
    const code = newShortCode(crop.code_prefix); const id = crypto.randomUUID();
    await queueLot(db, profile!.user_id, { id, org_id: profile!.org_id, short_code: code, qr_code: code, farmer_id: farmerId, crop_id: cropId, crate_count: c });
    setLot({ id, code, crop: i18n.language === 'te' && crop.name_te ? crop.name_te : crop.name }); setErr(null); setStep('checkpoint');
  }

  return (
    <Shell title={t('newLot')} back="/">
      {!master && !failed && <p className="text-muted">{t('loading')}</p>}
      {failed && <p role="alert" className="text-danger">{t('error')}</p>}
      {master && step === 'details' && (
        <div className="space-y-4">
          <label className="block"><span className="label">{t('farmer')}</span>
            <select className="input" value={farmerId} onChange={(e) => setFarmerId(e.target.value)} aria-label={t('farmer')}><option value="">{t('choose')}</option>{master.farmers.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.village}</option>)}</select></label>
          {adding ? (
            <div className="card space-y-2">
              <input className="input" placeholder={t('name')} aria-label={t('name')} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
              <input className="input" placeholder={t('village')} aria-label={t('village')} value={nf.village} onChange={(e) => setNf({ ...nf, village: e.target.value })} />
              <div className="grid grid-cols-2 gap-2"><button className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={() => void addFarmer()} data-testid="farmer-add-save">{t('save')}</button></div>
            </div>
          ) : <button className="btn" onClick={() => setAdding(true)} data-testid="farmer-add">{t('addFarmer')}</button>}
          <label className="block"><span className="label">{t('crop')}</span>
            <select className="input" value={cropId} onChange={(e) => setCropId(e.target.value)} aria-label={t('crop')}><option value="">{t('choose')}</option>{master.crops.map((c) => <option key={c.id} value={c.id}>{i18n.language === 'te' && c.name_te ? c.name_te : c.name}</option>)}</select></label>
          <label className="block"><span className="label">{t('crates')}</span><input className="input" inputMode="numeric" value={crates} onChange={(e) => setCrates(e.target.value)} aria-label={t('crates')} /></label>
          {err && <p role="alert" className="text-danger">{err}</p>}
          <button className="btn btn-primary" onClick={() => void next()} data-testid="details-next">{t('next')}</button>
        </div>
      )}
      {master && step === 'checkpoint' && lot && (
        <CheckpointForm lotId={lot.id} lotLabel={lot.code} lastStage={null} centres={master.centres} transporters={master.transporters} defaultCrates={crates ? Number(crates) : null} onSaved={() => setStep('done')} />
      )}
      {step === 'done' && lot && (
        <div className="space-y-4" data-testid="lot-created">
          <h2 className="text-xl font-bold">{t('lotCreated')}</h2>
          <QrCard lotId={lot.id} shortCode={lot.code} cropName={lot.crop} />
          <Link to="/" className="btn btn-primary">{t('done')}</Link>
        </div>
      )}
    </Shell>
  );
}
