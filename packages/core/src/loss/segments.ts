import type { SegmentKind } from '../types.ts';
import type { CropParams, Reading, SegmentLoss } from './types.ts';

/** Share of a kilo's full price still worth something: good + damaged x factor. */
export const qualityFactor = (goodPct: number, damagedPct: number, damagedFactor: number) => (goodPct + damagedFactor * damagedPct) / 100;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * weight loss  = max(0, w_prev - w_curr) x price x q_prev   (kilos that disappeared, at their prior quality)
 * quality loss = max(0, q_prev - q_curr) x w_curr x price   (value lost on the kilos that remain)
 */
export function segmentLoss(prev: Reading, curr: Reading, crop: CropParams, kind: SegmentKind): SegmentLoss {
  const qp = qualityFactor(prev.goodPct, prev.damagedPct, crop.damagedValueFactor);
  const qc = qualityFactor(curr.goodPct, curr.damagedPct, crop.damagedValueFactor);
  const weightLossKg = Math.max(0, prev.weightKg - curr.weightKg);
  const weightLossRs = weightLossKg * crop.pricePerKg * qp;
  const qualityLossRs = Math.max(0, qp - qc) * curr.weightKg * crop.pricePerKg;
  const valueFrom = prev.weightKg * crop.pricePerKg * qp;
  const total = weightLossRs + qualityLossRs;
  return {
    kind,
    durationH: round2((Date.parse(curr.at) - Date.parse(prev.at)) / 3_600_000),
    weightLossKg: round2(weightLossKg),
    weightLossRs: round2(weightLossRs),
    qualityLossRs: round2(qualityLossRs),
    totalLossRs: round2(total),
    valueFrom: round2(valueFrom),
    lossPct: valueFrom > 0 ? round2((total / valueFrom) * 100) : 0,
    measurementVariance: curr.weightKg > prev.weightKg,
  };
}

/** Weight differences under the crop's tolerance band are treated as scale noise. */
export const withinTolerance = (prev: Reading, curr: Reading, crop: CropParams) =>
  prev.weightKg > 0 && Math.abs(prev.weightKg - curr.weightKg) / prev.weightKg * 100 <= crop.unitTolerancePct;
