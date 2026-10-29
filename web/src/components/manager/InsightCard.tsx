import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateInsight, latestInsight, type InsightRow } from '../../lib/manager/analytics.ts';

export function InsightCard() {
  const { t, i18n } = useTranslation();
  const [row, setRow] = useState<InsightRow | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  useEffect(() => { void latestInsight().then(setRow); }, []);
  async function run() { setBusy(true); setErr(false); const r = await generateInsight(); if (r.error) setErr(true); else setRow(await latestInsight()); setBusy(false); }
  const te = i18n.language === 'te';
  const rec = (() => { try { const j = JSON.parse(row?.recommendation ?? '{}') as { en?: string; te?: string }; return te ? j.te ?? j.en : j.en; } catch { return null; } })();
  return (
    <section className="card space-y-2" data-testid="insight-card">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{t('insightTitle')}</h2>
        <button className="btn !min-h-10 !w-auto text-sm" onClick={() => void run()} disabled={busy} data-testid="insight-generate">{busy ? t('loading') : t('insightGenerate')}</button></div>
      {err && <p role="alert" className="text-danger text-sm">{t('error')}</p>}
      {row ? (<><p data-testid="insight-text">{te && row.text_te ? row.text_te : row.text_en}</p>{rec && <p className="text-sm font-semibold text-brand-strong" data-testid="insight-rec">{t('recommendation')}: {rec}</p>}
        <p className="text-xs text-muted">{t(row.numbers?.source === 'ai' ? 'insightSourceAi' : 'insightSourceTemplate')}</p></>) : <p className="text-sm text-muted">{t('insightNone')}</p>}
    </section>
  );
}
