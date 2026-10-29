import { callWithFallback, mondayOf, narrativeUsesOnlyGivenNumbers, templateInsight, type InsightInput } from './core/index.ts';
import type { Db } from './clients.ts';
import { env } from './http.ts';

type Row = Record<string, number | string | null>;
export async function buildInput(db: Db, org: string, days: number): Promise<InsightInput | null> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const a = { p_org: org, p_from: from };
  const kpi = ((await db.rpc('dashboard_kpis', a)).data as Row[] | null)?.[0];
  if (!kpi || !Number(kpi.lots)) return null;
  const stages = ((await db.rpc('stage_loss', a)).data ?? []) as Row[];
  const centres = ((await db.rpc('centre_loss', a)).data ?? []) as Row[];
  const top = stages[0], worst = centres[0], best = centres[centres.length - 1];
  return {
    days, kpis: { totalLossRs: Number(kpi.total_loss_rs), valueIn: Number(kpi.value_in), lossPct: Number(kpi.loss_pct), lots: Number(kpi.lots) },
    topStage: top ? { kind: String(top.kind), lossRs: Number(top.total_loss_rs), lossPct: Number(top.loss_pct) } : null,
    worstCentre: worst ? { name: String(worst.centre_name), lossPct: Number(worst.loss_pct), lossRs: Number(worst.total_loss_rs), avgWaitH: Number(worst.avg_wait_h) } : null,
    bestCentre: best ? { name: String(best.centre_name), lossPct: Number(best.loss_pct), avgWaitH: Number(best.avg_wait_h) } : null,
  };
}

/** Template first; AI rewording is used only when configured and only if it invents no numbers. */
export async function generateInsight(db: Db, org: string, days = 14): Promise<'template' | 'ai' | 'none'> {
  const input = await buildInput(db, org, days);
  if (!input) return 'none';
  const t = templateInsight(input);
  let en = t.en, source: 'template' | 'ai' = 'template';
  const hasGroq = env('GROQ_API_KEY') && env('GROQ_MODEL');
  const hasGemini = env('GEMINI_API_KEY') && env('GEMINI_MODEL');
  if (hasGroq || hasGemini) {
    try {
      const given = JSON.stringify(input);
      const out = (await callWithFallback(fetch, [
        { provider: 'groq', apiKey: env('GROQ_API_KEY'), model: env('GROQ_MODEL') },
        { provider: 'gemini', apiKey: env('GEMINI_API_KEY'), model: env('GEMINI_MODEL') },
        { provider: 'gemini', apiKey: env('GEMINI_API_KEY'), model: env('GEMINI_MODEL_FALLBACK') },
      ], { prompt: `Rewrite this summary in plain, friendly English for a produce processor manager in at most 70 words. Use ONLY these numbers, do not add or change any: ${given}\nSummary: ${t.en}`, schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } })) as { text?: string };
      if (typeof out.text === 'string' && narrativeUsesOnlyGivenNumbers(out.text, given)) { en = out.text; source = 'ai'; }
    } catch { /* keep the template */ }
  }
  await db.from('insights').upsert({ org_id: org, week_start: mondayOf(new Date()), text_en: en, text_te: t.te, recommendation: JSON.stringify({ en: t.recEn, te: t.recTe }), numbers: { source, input } }, { onConflict: 'org_id,week_start' });
  return source;
}
