import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase.ts';

interface Report { short_code: string; crop_name: string; crop_name_te: string | null; farmer_name: string; village: string; recorded_at: string; weight_kg: number; quality_good_pct: number | null; quality_damaged_pct: number | null; quality_rotten_pct: number | null; quality_is_ai: boolean; org_name: string; is_demo: boolean }

export default function PublicReport() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [r, setR] = useState<Report | null | undefined>(undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    void supabase.rpc('get_public_lot_report', { p_token: token }).then(({ data }) => setR(((data as Report[] | null) ?? [])[0] ?? null));
    void supabase.functions.invoke('public-photo', { body: { token } }).then(({ data }) => setPhoto((data as { url?: string } | null)?.url ?? null));
  }, [token]);
  if (r === undefined) return <p className="p-6 text-center">{t('loading')}</p>;
  if (r === null) return <p className="p-6 text-center" role="alert" data-testid="report-invalid">{t('reportInvalid')}</p>;
  return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      <h1 className="text-2xl font-extrabold">{t('farmerReport')}</h1>
      {r.is_demo && <p className="rounded-lg bg-warn/15 p-2 text-sm font-semibold text-warn" data-testid="simulated-badge">{t('simulatedBanner')}</p>}
      <div className="card space-y-1">
        <div className="text-sm text-muted">{r.org_name} · {r.short_code}</div>
        <div><b>{r.farmer_name}</b>, {r.village}</div>
        <div>{i18n.language === 'te' && r.crop_name_te ? r.crop_name_te : r.crop_name}</div>
        <div className="text-3xl font-extrabold" data-testid="report-weight">{r.weight_kg} kg</div>
        <time className="text-sm text-muted">{new Date(r.recorded_at).toLocaleString()}</time>
        {r.quality_good_pct !== null && <div className="text-sm">{r.quality_is_ai ? t('qualityAi') : t('qualityTitle')}: {t('good')} {r.quality_good_pct}% · {t('damaged')} {r.quality_damaged_pct}% · {t('rotten')} {r.quality_rotten_pct}%</div>}
      </div>
      {photo && <img src={photo} alt={t('producePhoto')} className="w-full rounded-xl border border-line" />}
      <p className="text-xs text-muted">{t('reportNote')}</p>
    </main>
  );
}
