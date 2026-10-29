import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth.tsx';
import { supabase } from '../../lib/supabase.ts';
import { loadMaster, type MasterData } from '../../lib/api.ts';
import type { Centre, Crop } from '../../lib/db.ts';
import { createTelegramLink, demoAction, telegramConnected } from '../../lib/manager/analytics.ts';
import { ManagerShell, SimulatedBadge } from '../../components/manager/ManagerShell.tsx';
import { TeamSection } from '../../components/manager/TeamSection.tsx';

/** A blank box is not zero: it is invalid, so a blank price can never silently zero a crop's history. */
const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
function Field({ label, value, onChange, type = 'number', step }: { label: string; value: string; onChange: (v: string) => void; type?: string; step?: string }) {
  return <label className="block"><span className="label">{label}</span><input className="input !min-h-10 !text-base" type={type} step={step} inputMode={type === 'number' ? 'decimal' : undefined} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function CropRow({ crop, onSaved }: { crop: Crop; onSaved: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState({ price: String(crop.price_per_kg), dmg: String(crop.damaged_value_factor ?? 0.5), heat: String(crop.heat_threshold_c), wait: String(crop.max_safe_wait_hours), tol: String(crop.unit_tolerance_pct ?? 1) });
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const row = { price_per_kg: num(v.price), damaged_value_factor: num(v.dmg), heat_threshold_c: num(v.heat), max_safe_wait_hours: num(v.wait), unit_tolerance_pct: num(v.tol) };
    if (Object.values(row).some((x) => !Number.isFinite(x)) || row.damaged_value_factor < 0 || row.damaged_value_factor > 1 || row.price_per_kg < 0 || row.max_safe_wait_hours <= 0 || row.unit_tolerance_pct < 0) return setMsg(t('error'));
    const { error } = await supabase.from('crops').update(row).eq('id', crop.id);
    setMsg(error ? t('error') : t('savedOk')); if (!error) onSaved();
  }
  return (
    <div className="card space-y-2" data-testid="crop-row"><b>{crop.name}</b>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label={t('pricePerKg')} value={v.price} onChange={(x) => setV({ ...v, price: x })} /><Field label={t('damagedFactor')} value={v.dmg} step="0.05" onChange={(x) => setV({ ...v, dmg: x })} />
        <Field label={t('heatThreshold')} value={v.heat} onChange={(x) => setV({ ...v, heat: x })} /><Field label={t('maxWait')} value={v.wait} step="0.5" onChange={(x) => setV({ ...v, wait: x })} /><Field label={t('tolerance')} value={v.tol} step="0.1" onChange={(x) => setV({ ...v, tol: x })} />
      </div>
      <div className="flex items-center gap-3"><button className="btn !min-h-10 !w-auto text-base" onClick={() => void save()} data-testid="crop-save">{t('save')}</button>{msg && <span className="text-sm text-muted" role="status">{msg}</span>}</div>
      <p className="text-xs text-muted">{t('priceNote')}</p></div>
  );
}
function CentreRow({ c, onSaved }: { c: Centre; onSaved: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState({ name: c.name, radius: String(c.radius_m ?? 300), exp: c.expected_transport_h == null ? '' : String(c.expected_transport_h), lat: String(c.lat), lng: String(c.lng) });
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const row = { name: v.name.trim(), radius_m: num(v.radius), expected_transport_h: v.exp.trim() === '' ? null : num(v.exp), lat: num(v.lat), lng: num(v.lng) };
    if (!row.name || !(row.radius_m > 0) || !Number.isFinite(row.lat) || !Number.isFinite(row.lng) || (row.expected_transport_h !== null && !(row.expected_transport_h >= 0))) return setMsg(t('error'));
    const { error } = await supabase.from('centres').update(row).eq('id', c.id);
    setMsg(error ? t('error') : t('savedOk')); if (!error) onSaved();
  }
  return (
    <div className="card space-y-2"><div className="text-sm font-semibold text-muted">{t(`centreType_${c.type}`)}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="col-span-2 sm:col-span-1"><Field label={t('centreName')} type="text" value={v.name} onChange={(x) => setV({ ...v, name: x })} /></div>
        <Field label={t('radius')} value={v.radius} onChange={(x) => setV({ ...v, radius: x })} />{c.type !== 'factory' && <Field label={t('expectedTransport')} value={v.exp} step="0.1" onChange={(x) => setV({ ...v, exp: x })} />}
        <Field label={t('lat')} value={v.lat} step="0.0001" onChange={(x) => setV({ ...v, lat: x })} /><Field label={t('lng')} value={v.lng} step="0.0001" onChange={(x) => setV({ ...v, lng: x })} />
      </div>
      <div className="flex items-center gap-3"><button className="btn !min-h-10 !w-auto text-base" onClick={() => void save()}>{t('save')}</button>{msg && <span className="text-sm text-muted" role="status">{msg}</span>}</div></div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { profile, orgIsDemo } = useAuth();
  const [m, setM] = useState<MasterData | null>(null); const [error, setError] = useState(false);
  const [tgOn, setTgOn] = useState<boolean | null>(null); const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<string | null>(null); const [demoBusy, setDemoBusy] = useState(false);
  const [newC, setNewC] = useState({ name: '', type: 'collection_centre', lat: '', lng: '' });
  const [newCrop, setNewCrop] = useState({ name: '', nameTe: '', prefix: '', price: '', heat: '30', wait: '3' }); const [addMsg, setAddMsg] = useState<string | null>(null);
  const [newT, setNewT] = useState({ name: '', vehicle: '' });
  const bot = (import.meta.env as Record<string, string | undefined>).VITE_TELEGRAM_BOT;
  const reload = () => loadMaster().then((x) => { setM(x); setError(false); }).catch(() => setError(true));
  useEffect(() => { void reload(); void telegramConnected().then(setTgOn); }, []);

  async function connectTelegram() { try { const tok = await createTelegramLink(); setTgUrl(bot ? `https://t.me/${bot}?start=${tok}` : ''); } catch { setTgUrl(null); setError(true); } }
  async function demo(action: 'load' | 'reset') { setDemoBusy(true); setDemoMsg(t('demoLoading')); const r = await demoAction(action); setDemoMsg(r.ok ? t(action === 'load' ? 'demoDone' : 'demoReset') : t('demoFailed')); setDemoBusy(false); }
  async function addCentre() {
    if (!profile || !newC.name.trim() || !Number.isFinite(num(newC.lat)) || !Number.isFinite(num(newC.lng))) return;
    const { error: e } = await supabase.from('centres').insert({ org_id: profile.org_id, name: newC.name.trim(), type: newC.type, lat: Number(newC.lat), lng: Number(newC.lng) });
    if (!e) { setNewC({ name: '', type: 'collection_centre', lat: '', lng: '' }); void reload(); }
  }
  async function addCrop() {
    if (!profile) return;
    const row = { org_id: profile.org_id, name: newCrop.name.trim(), name_te: newCrop.nameTe.trim() || null, code_prefix: newCrop.prefix.trim().toUpperCase(), price_per_kg: num(newCrop.price), heat_threshold_c: num(newCrop.heat), max_safe_wait_hours: num(newCrop.wait) };
    if (row.name.length < 2 || !/^[A-Z]$/.test(row.code_prefix) || !(row.price_per_kg >= 0) || !(row.heat_threshold_c > 0) || !(row.max_safe_wait_hours > 0)) return setAddMsg(t('error'));
    const { error: e } = await supabase.from('crops').insert(row);
    setAddMsg(e ? t('error') : t('savedOk'));
    if (!e) { setNewCrop({ name: '', nameTe: '', prefix: '', price: '', heat: '30', wait: '3' }); void reload(); }
  }
  async function addTransporter() {
    if (!profile || !newT.name.trim()) return;
    const { error: e } = await supabase.from('transporters').insert({ org_id: profile.org_id, name: newT.name.trim(), vehicle_no: newT.vehicle.trim() || null });
    if (!e) { setNewT({ name: '', vehicle: '' }); void reload(); }
  }
  return (
    <ManagerShell>
      <div className="flex items-center gap-2"><h1 className="text-xl font-extrabold">{t('mgr_settings')}</h1>{orgIsDemo && <SimulatedBadge />}</div>
      {error && <p role="alert" className="text-danger">{t('error')}</p>}
      {!m && !error && <p className="text-muted">{t('loading')}</p>}
      {orgIsDemo && (
        <section className="card space-y-2" data-testid="demo-controls"><h2 className="font-bold">{t('simulatedBanner')}</h2>
          <div className="grid grid-cols-2 gap-2"><button className="btn btn-primary !min-h-12 text-base" disabled={demoBusy} onClick={() => void demo('load')} data-testid="demo-load">{t('loadDemo')}</button><button className="btn !min-h-12 text-base" disabled={demoBusy} onClick={() => void demo('reset')} data-testid="demo-reset">{t('resetDemo')}</button></div>
          {demoMsg && <p role="status" className="text-sm text-muted" data-testid="demo-msg">{demoMsg}</p>}</section>
      )}
      {m && (<>
        <section className="space-y-2"><h2 className="font-bold">{t('settingsCrops')}</h2>
          {m.crops.length === 0 && <p className="text-sm text-warn" data-testid="no-crops">{t('noCropsHint')}</p>}
          {m.crops.map((c) => <CropRow key={c.id} crop={c} onSaved={() => void reload()} />)}
          <div className="card space-y-2" data-testid="add-crop"><b>{t('addCrop')}</b>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label={t('name')} type="text" value={newCrop.name} onChange={(x) => setNewCrop({ ...newCrop, name: x })} /><Field label={t('cropNameTe')} type="text" value={newCrop.nameTe} onChange={(x) => setNewCrop({ ...newCrop, nameTe: x })} />
              <Field label={t('cropPrefix')} type="text" value={newCrop.prefix} onChange={(x) => setNewCrop({ ...newCrop, prefix: x.slice(0, 1) })} /><Field label={t('pricePerKg')} value={newCrop.price} onChange={(x) => setNewCrop({ ...newCrop, price: x })} />
              <Field label={t('heatThreshold')} value={newCrop.heat} onChange={(x) => setNewCrop({ ...newCrop, heat: x })} /><Field label={t('maxWait')} value={newCrop.wait} step="0.5" onChange={(x) => setNewCrop({ ...newCrop, wait: x })} />
            </div>
            <div className="flex items-center gap-3"><button className="btn !min-h-10 !w-auto text-base" onClick={() => void addCrop()} data-testid="crop-add">{t('addCrop')}</button>{addMsg && <span className="text-sm text-muted" role="status" data-testid="add-msg">{addMsg}</span>}</div></div></section>
        <section className="space-y-2"><h2 className="font-bold">{t('settingsCentres')}</h2>
          {m.centres.length === 0 && <p className="text-sm text-warn" data-testid="no-centres">{t('noCentresHint')}</p>}
          {m.centres.map((c) => <CentreRow key={c.id} c={c} onSaved={() => void reload()} />)}
          <div className="card space-y-2"><b>{t('addCentre')}</b>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label={t('centreName')} type="text" value={newC.name} onChange={(x) => setNewC({ ...newC, name: x })} />
              <label className="block"><span className="label">{t('centreType')}</span><select className="input !min-h-10 !text-base" value={newC.type} onChange={(e) => setNewC({ ...newC, type: e.target.value })} data-testid="new-centre-type">{['collection_centre', 'factory', 'storage'].map((k) => <option key={k} value={k}>{t(`centreType_${k}`)}</option>)}</select></label>
              <Field label={t('lat')} value={newC.lat} step="0.0001" onChange={(x) => setNewC({ ...newC, lat: x })} /><Field label={t('lng')} value={newC.lng} step="0.0001" onChange={(x) => setNewC({ ...newC, lng: x })} />
            </div>
            <button className="btn !min-h-10 !w-auto text-base" onClick={() => void addCentre()}>{t('addCentre')}</button></div></section>
        <section className="space-y-2"><h2 className="font-bold">{t('settingsTransporters')}</h2>
          {m.transporters.map((tr) => <div key={tr.id} className="card text-sm"><b>{tr.name}</b>{tr.vehicle_no ? ` · ${tr.vehicle_no}` : ''}</div>)}
          <div className="card space-y-2"><div className="grid grid-cols-2 gap-2"><Field label={t('name')} type="text" value={newT.name} onChange={(x) => setNewT({ ...newT, name: x })} /><Field label={t('vehicleNo')} type="text" value={newT.vehicle} onChange={(x) => setNewT({ ...newT, vehicle: x })} /></div>
            <button className="btn !min-h-10 !w-auto text-base" onClick={() => void addTransporter()}>{t('addTransporter')}</button></div></section>
      </>)}
      {!orgIsDemo && <TeamSection />}
      <section className="card space-y-2" data-testid="telegram-card"><h2 className="font-bold">{t('telegramTitle')}</h2><p className="text-sm text-muted">{tgOn ? t('telegramConnected') : t('telegramNot')}</p>
        <button className="btn !min-h-10 !w-auto text-base" onClick={() => void connectTelegram()} data-testid="telegram-connect">{t('telegramConnect')}</button>
        {tgUrl !== null && (tgUrl === '' ? <p className="text-sm text-warn">{t('telegramBotMissing')}</p> : <p className="text-sm"><a className="font-semibold text-brand-strong underline" href={tgUrl} target="_blank" rel="noreferrer" data-testid="telegram-link">{tgUrl}</a><br /><span className="text-muted">{t('telegramHint')}</span></p>)}</section>
    </ManagerShell>
  );
}
