import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ManagerShell } from '../../components/manager/ManagerShell.tsx';
import { acknowledgeAlert, loadAlerts, type AlertRow } from '../../lib/manager/analytics.ts';

export default function AlertsPage() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<AlertRow[] | null>(null); const [err, setErr] = useState(false);
  const reload = () => loadAlerts().then(setRows).catch(() => setErr(true));
  useEffect(() => { void reload(); }, []);
  return (
    <ManagerShell>
      <h1 className="text-2xl font-extrabold">{t('mgr_alerts')}</h1>
      {err && <p role="alert" className="text-danger">{t('error')}</p>}
      {rows?.length === 0 && <p>{t('noAlerts')}</p>}
      <ul className="space-y-2" data-testid="alerts-list">
        {(rows ?? []).map((a) => (
          <li key={a.id} className="card card-hover flex flex-wrap items-center gap-2" data-testid="alert-item">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.severity === 'critical' ? 'bg-danger/15 text-danger' : 'bg-warn/15 text-warn'}`}>{t(`severity_${a.severity}`)}</span>
            <span className="min-w-0 flex-1">{i18n.language === 'te' && a.message_te ? a.message_te : a.message_en}<br /><Link className="text-xs underline" to={`/m/lot/${a.lot?.short_code}`}>{a.lot?.short_code}</Link></span>
            {a.acknowledged_at ? <span className="text-xs text-muted">{t('acknowledged')}</span> : <button className="btn !min-h-10 !w-auto text-sm" onClick={() => void acknowledgeAlert(a.id).then(reload)} data-testid="alert-ack">{t('acknowledge')}</button>}
          </li>
        ))}
      </ul>
    </ManagerShell>
  );
}
