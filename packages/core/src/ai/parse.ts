// AI output is untrusted: parse defensively, clamp, and never let a bad answer block the worker.
export interface ScaleResult { weightKg: number | null; rawValue: number | null; unit: string | null; confidence: number; readable: boolean; needsManual: boolean }
export interface QualityResult { goodPct: number; damagedPct: number; rottenPct: number; defects: string[]; confidence: number; notes: string }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp01 = (v: unknown) => Math.min(1, Math.max(0, num(v) ?? 0));
const MIN_CONFIDENCE = 0.6;

export function parseScaleResult(raw: unknown): ScaleResult {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawValue = num(o.value);
  const unit = typeof o.unit === 'string' ? o.unit.toLowerCase() : null;
  const confidence = clamp01(o.confidence);
  const readable = o.readable === true && rawValue !== null && rawValue > 0;
  let weightKg: number | null = null;
  if (readable) {
    if (unit === 'kg' || unit === 'kgs') weightKg = rawValue;
    else if (unit === 'g') weightKg = rawValue! / 1000;
    else if (unit === 'lb' || unit === 'lbs') weightKg = rawValue! * 0.45359237;
  }
  // low confidence or an odd unit: do not pre-fill, ask the worker to type it
  const usable = weightKg !== null && weightKg > 0 && weightKg < 100000 && confidence >= MIN_CONFIDENCE;
  return { weightKg: usable ? Math.round(weightKg! * 100) / 100 : null, rawValue, unit, confidence, readable, needsManual: !usable };
}

export function parseQualityResult(raw: unknown): QualityResult | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const g = num(o.good_pct), d = num(o.damaged_pct), r = num(o.rotten_pct);
  if (g === null || d === null || r === null || g < 0 || d < 0 || r < 0) return null;
  const sum = g + d + r;
  if (sum < 90 || sum > 110) return null;
  // normalise so the three always add to exactly 100
  const goodPct = Math.round((g / sum) * 1000) / 10, damagedPct = Math.round((d / sum) * 1000) / 10;
  return { goodPct, damagedPct, rottenPct: Math.round((100 - goodPct - damagedPct) * 10) / 10, defects: Array.isArray(o.defects) ? o.defects.filter((x): x is string => typeof x === 'string').slice(0, 6) : [], confidence: clamp01(o.confidence), notes: typeof o.notes === 'string' ? o.notes.slice(0, 200) : '' };
}
