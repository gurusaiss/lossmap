// Weekly summary: the numbers are computed in SQL; the words are a template, optionally rephrased by AI and only accepted
// if the rephrasing uses no number that was not given to it.
export interface InsightInput {
  days: number;
  kpis: { totalLossRs: number; valueIn: number; lossPct: number; lots: number };
  topStage: { kind: string; lossRs: number; lossPct: number } | null;
  worstCentre: { name: string; lossPct: number; lossRs: number; avgWaitH: number } | null;
  bestCentre: { name: string; lossPct: number; avgWaitH: number } | null;
}
export interface InsightText { en: string; te: string; recEn: string; recTe: string }

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = (n: number) => `${Math.round(n * 10) / 10}%`.replace('.0%', '%');
const STAGE_EN: Record<string, string> = { waiting: 'waiting at the centre', transport: 'transport to the factory', handling_in: 'moving from farm to centre', storage: 'storage', other: 'other steps' };
const STAGE_TE: Record<string, string> = { waiting: 'కేంద్రంలో వేచి ఉండటం', transport: 'ఫ్యాక్టరీకి రవాణా', handling_in: 'పొలం నుంచి కేంద్రానికి', storage: 'నిల్వ', other: 'ఇతర దశలు' };

export function templateInsight(i: InsightInput): InsightText {
  const k = i.kpis;
  const en = [`Last ${i.days} days: ${inr(k.totalLossRs)} of value was lost across ${k.lots} lots (${pct(k.lossPct)} of ${inr(k.valueIn)} farm-gate value).`,
    i.topStage ? `The biggest loss is ${STAGE_EN[i.topStage.kind] ?? i.topStage.kind}: ${inr(i.topStage.lossRs)}.` : '',
    i.worstCentre && i.bestCentre && i.worstCentre.name !== i.bestCentre.name ? `${i.worstCentre.name} loses ${pct(i.worstCentre.lossPct)} (average wait ${i.worstCentre.avgWaitH} h) against ${pct(i.bestCentre.lossPct)} at ${i.bestCentre.name} (${i.bestCentre.avgWaitH} h).` : ''].filter(Boolean).join(' ');
  const te = [`గత ${i.days} రోజులు: ${k.lots} లాట్లలో ${inr(k.totalLossRs)} విలువ నష్టం (${inr(k.valueIn)} లో ${pct(k.lossPct)}).`,
    i.topStage ? `అత్యధిక నష్టం: ${STAGE_TE[i.topStage.kind] ?? i.topStage.kind} (${inr(i.topStage.lossRs)}).` : '',
    i.worstCentre && i.bestCentre && i.worstCentre.name !== i.bestCentre.name ? `${i.worstCentre.name} లో ${pct(i.worstCentre.lossPct)} (సగటు వేచి ఉండే సమయం ${i.worstCentre.avgWaitH} గం), ${i.bestCentre.name} లో ${pct(i.bestCentre.lossPct)}.` : ''].filter(Boolean).join(' ');
  const w = i.worstCentre;
  return { en, te, recEn: w ? `Dispatch ${w.name} lots sooner: shortening the wait is the quickest way to cut loss there.` : 'Record more checkpoints to get a recommendation.', recTe: w ? `${w.name} లాట్లను త్వరగా పంపండి: అక్కడ వేచి ఉండే సమయం తగ్గిస్తే నష్టం తగ్గుతుంది.` : 'సిఫార్సు కోసం మరిన్ని చెక్‌పాయింట్లు నమోదు చేయండి.' };
}

const numbersIn = (t: string) => (t.match(/\d[\d,]*\.?\d*/g) ?? []).map((x) => x.replace(/,/g, '').replace(/\.$/, ''));

/** AI wording is accepted only if every number in it also appears in the data it was given. */
export function narrativeUsesOnlyGivenNumbers(text: string, given: string): boolean {
  const allowed = new Set(numbersIn(given));
  return numbersIn(text).every((n) => allowed.has(n) || allowed.has(String(Math.round(Number(n)))));
}
export const mondayOf = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
