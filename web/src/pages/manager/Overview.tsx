import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth.tsx';
import { ManagerShell, SimulatedBadge } from '../../components/manager/ManagerShell.tsx';
import { InsightCard } from '../../components/manager/InsightCard.tsx';
import { loadOverview, loadSegments, type Segment } from '../../lib/manager/analytics.ts';
import { hoursLabel, inr, pct } from '../../lib/manager/format.ts';
import { loadMasterCached } from '../../lib/master.ts';
import type { Centre } from '../../lib/db.ts';

const BarsChart = lazy(() => import('../../components/manager/Charts.tsx').then((m) => ({ default: m.BarsChart })));
const CentreMap = lazy(() => import('../../components/manager/CentreMap.tsx'));
type Data = Awaited<ReturnType<typeof loadOverview>>;
type Pick = { kind?: string; centreId?: string; transporterId?: string; hour?: number; title: string };

export default function Overview() {
  const { t } = useTranslation();
  const { orgIsDemo } = useAuth();
  const [days, setDays] = useState<number | null>(null);
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(false);
  const [centres, setCentres] = useState<Centre[]>([]); const [mapOk, setMapOk] = useState(true);
  const [drill, setDrill] = useState<Pick | null>(null); const [segs, setSegs] = useState<Segment[] | null>(null);
  useEffect(() => { setD(null); loadOverview(days).then((x) => { setD(x); setErr(false); }).catch(() => setErr(true)); }, [days]);
  useEffect(() => { void loadMasterCached().then((m) => setCentres(m?.centres ?? [])); }, []);
  const open = useCallback((p: Pick) => { setDrill(p); setSegs(null); void loadSegments(p).then(setSegs).catch(() => setSegs([])); }, []);
  const mapCentres = (d?.centres ?? []).flatMap((c) => { const m = centres.find((x) => x.id === c.centre_id); return m ? [{ id: c.centre_id, name: c.centre_name, lat: m.lat, lng: m.lng, lossRs: c.total_loss_rs, lossPct: c.loss_pct }] : []; });
  const k = d?.kpis;
  return (
    <ManagerShell>
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold">{t('mgr_overview')}</h1>{orgIsDemo && <SimulatedBadge />}<span className="flex-1" />
        <select className="input !min-h-10 !w-auto !text-base" value={days ?? ''} onChange={(e) => setDays(e.target.value ? Number(e.target.value) : null)} aria-label={t('period')}>
          <option value="">{t('allTime')}</option><option value="7">{t('lastDays', { n: 7 })}</option><option value="14">{t('lastDays', { n: 14 })}</option><option value="30">{t('lastDays', { n: 30 })}</option></select></div>
      {err && <p role="alert" className="text-danger">{t('error')}</p>}
      {!d && !err && <p className="text-muted">{t('loading')}</p>}
      {d && !k && <p className="card" data-testid="no-data">{t('noData')}</p>}
      {d && k && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card" data-testid="kpi-lost"><div className="text-sm text-muted">{t('kpiLost')}</div><div className="text-3xl font-extrabold" style={{ color: 'var(--s2)' }}>{inr(k.total_loss_rs)}</div><div className="text-sm">{t('kpiOf', { pct: pct(k.loss_pct), value: inr(k.value_in), lots: k.lots })}</div></div>
            <div className="card" data-testid="kpi-worst"><div className="text-sm text-muted">{t('kpiWorst')}</div><div className="text-xl font-extrabold">{k.worst_centre_name ?? '—'}</div><div className="text-sm">{inr(k.worst_centre_loss_rs)}</div></div>
            <Link to="/m/alerts" className="card" data-testid="kpi-alerts"><div className="text-sm text-muted">{t('kpiAlerts')}</div><div className="text-3xl font-extrabold">{k.open_alerts}</div></Link>
          </div>
          <InsightCard />
          <section className="card space-y-2"><h2 className="font-bold">{t('byStage')}</h2>
            <Suspense fallback={<p className="text-muted">{t('loading')}</p>}><div data-testid="stage-chart"><BarsChart label={t('byStage')} data={d.stages.map((s) => ({ key: s.kind, name: t(`stage_${s.kind}`), value: s.total_loss_rs }))} onPick={(kind) => open({ kind, title: t(`stage_${kind}`) })} /></div></Suspense>
            <table className="w-full text-sm" data-testid="stage-table"><thead><tr className="text-left text-muted"><th>{t('stage')}</th><th className="text-right">₹</th><th className="text-right">%</th></tr></thead>
              <tbody>{d.stages.map((s) => <tr key={s.kind} className="cursor-pointer border-t border-line" onClick={() => open({ kind: s.kind, title: t(`stage_${s.kind}`) })}><td className="py-2">{t(`stage_${s.kind}`)}</td><td className="text-right">{inr(s.total_loss_rs)}</td><td className="text-right">{pct(s.loss_pct)}</td></tr>)}</tbody></table>
            <p className="text-xs text-muted">{t('pctNote')}</p></section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card space-y-2"><h2 className="font-bold">{t('byCentre')}</h2>
              <ol className="space-y-2" data-testid="centre-ranking">{d.centres.map((c) => <li key={c.centre_id}><button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => open({ centreId: c.centre_id, title: c.centre_name })}><span><b>{c.centre_name}</b><br /><span className="text-xs text-muted">{t('avgWait')} {hoursLabel(c.avg_wait_h)} · {c.lots} {t('lots')}</span></span><span className="text-right"><b style={{ color: 'var(--s2)' }}>{pct(c.loss_pct)}</b><br /><span className="text-xs">{inr(c.total_loss_rs)}</span></span></button></li>)}</ol></section>
            <section className="card space-y-2"><h2 className="font-bold">{t('byTransporter')}</h2>
              <ol className="space-y-2" data-testid="transporter-ranking">{d.transporters.map((c) => <li key={c.transporter_id}><button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => open({ transporterId: c.transporter_id, title: c.transporter_name })}><span><b>{c.transporter_name}</b><br /><span className="text-xs text-muted">{c.vehicle_no} · {c.trips} {t('trips')} · {hoursLabel(c.avg_transport_h)}</span></span><span className="text-right"><b>{pct(c.loss_pct)}</b><br /><span className="text-xs">{inr(c.total_loss_rs)}</span></span></button></li>)}</ol></section>
          </div>
          <section className="card space-y-2"><h2 className="font-bold">{t('byHour')}</h2>
            <Suspense fallback={null}><BarsChart label={t('byHour')} data={d.hours.map((h) => ({ key: String(h.arrival_hour), name: `${h.arrival_hour}:00`, value: h.total_loss_rs }))} onPick={(h) => open({ hour: Number(h), title: `${h}:00` })} /></Suspense>
            <table className="w-full text-sm" data-testid="hour-table"><thead><tr className="text-left text-muted"><th>{t('arrivalHour')}</th><th className="text-right">{t('avgWait')}</th><th className="text-right">%</th></tr></thead>
              <tbody>{d.hours.map((h) => <tr key={h.arrival_hour} className="border-t border-line"><td className="py-1">{h.arrival_hour}:00</td><td className="text-right">{hoursLabel(h.avg_wait_h)}</td><td className="text-right">{pct(h.loss_pct)}</td></tr>)}</tbody></table></section>
          {drill && (
            <section className="card space-y-2" data-testid="drill-panel"><div className="flex items-center justify-between"><h2 className="font-bold">{drill.title}</h2><button className="underline" onClick={() => setDrill(null)}>{t('close')}</button></div>
              {!segs && <p className="text-muted">{t('loading')}</p>}
              <ul className="divide-y divide-line text-sm">{(segs ?? []).slice(0, 30).map((s) => <li key={s.to_checkpoint_id}><Link className="flex justify-between gap-2 py-2" to={`/m/lot/${s.lot_code}`}><span>{s.lot_code} · {t(`stage_${s.kind}`)} · {hoursLabel(s.duration_h)}</span><b>{inr(s.total_loss_rs)}</b></Link></li>)}</ul></section>
          )}
          {mapCentres.length > 0 && mapOk && <Suspense fallback={null}><ErrorCatch onError={() => setMapOk(false)}><CentreMap centres={mapCentres} /></ErrorCatch></Suspense>}
          {(!mapOk || mapCentres.length === 0) && <ul className="card text-sm" data-testid="centre-list">{d.centres.map((c) => <li key={c.centre_id}>{c.centre_name}: {inr(c.total_loss_rs)}</li>)}</ul>}
        </>
      )}
    </ManagerShell>
  );
}

import { Component, type ReactNode } from 'react';
class ErrorCatch extends Component<{ children: ReactNode; onError: () => void }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.bad ? null : this.props.children; }
}
