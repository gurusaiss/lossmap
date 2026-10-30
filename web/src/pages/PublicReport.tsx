import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase.ts';
import { setLang, type Lang } from '../i18n/index.ts';

interface Report { short_code: string; crop_name: string; crop_name_te: string | null; farmer_name: string; village: string; recorded_at: string; weight_kg: number; quality_good_pct: number | null; quality_damaged_pct: number | null; quality_rotten_pct: number | null; quality_is_ai: boolean; org_name: string; is_demo: boolean }

export default function PublicReport() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [r, setR] = useState<Report | null | undefined>(undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  const lang = i18n.language as Lang;
  useEffect(() => {
    void supabase.rpc('get_public_lot_report', { p_token: token }).then(({ data }) => setR(((data as Report[] | null) ?? [])[0] ?? null));
    void supabase.functions.invoke('public-photo', { body: { token } }).then(({ data }) => setPhoto((data as { url?: string } | null)?.url ?? null));
  }, [token]);
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <span className="flex-1 text-lg font-extrabold text-brand-strong">LossMap</span>
        <button className="min-h-10 min-w-10 rounded-lg border border-line px-2 text-sm font-semibold" aria-label={t('language')} onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{lang === 'te' ? 'EN' : 'తె'}</button>
      </header>
      <main className="animate-in space-y-3 p-4">
        {r === undefined && <p className="p-6 text-center text-muted">{t('loading')}</p>}
        {r === null && <p className="card p-6 text-center" role="alert" data-testid="report-invalid">{t('reportInvalid')}</p>}
        {r && (
          <>
            <h1 className="text-2xl font-extrabold">{t('farmerReport')}</h1>
            {r.is_demo && <p className="rounded-lg bg-warn/15 p-2 text-sm font-semibold text-warn" data-testid="simulated-badge">{t('simulatedBanner')}</p>}
            <div className="card space-y-2">
              <div className="text-sm text-muted">{r.org_name} · {r.short_code}</div>
              <div className="text-lg"><b>{r.farmer_name}</b>, {r.village}</div>
              <div className="text-muted">{i18n.language === 'te' && r.crop_name_te ? r.crop_name_te : r.crop_name}</div>
              <div className="text-figure text-4xl font-extrabold" data-testid="report-weight">{r.weight_kg} kg</div>
              <time className="block text-sm text-muted">{new Date(r.recorded_at).toLocaleString()}</time>
            </div>
            {r.quality_good_pct !== null && (
              <div className="card space-y-2">
                <div className="text-sm font-bold">{r.quality_is_ai ? t('qualityAi') : t('qualityTitle')}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-2xl font-extrabold text-brand-strong">{r.quality_good_pct}%</div><div className="text-xs text-muted">{t('good')}</div></div>
                  <div><div className="text-2xl font-extrabold text-warn">{r.quality_damaged_pct}%</div><div className="text-xs text-muted">{t('damaged')}</div></div>
                  <div><div className="text-2xl font-extrabold text-danger">{r.quality_rotten_pct}%</div><div className="text-xs text-muted">{t('rotten')}</div></div>
                </div>
              </div>
            )}
            {photo && <img src={photo} alt={t('producePhoto')} className="w-full rounded-xl border border-line" />}
            <p className="text-xs text-muted">{t('reportNote')}</p>
          </>
        )}
      </main>
    </div>
  );
}
