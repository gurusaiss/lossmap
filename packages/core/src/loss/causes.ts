import type { SegmentKind } from '../types.ts';
import type { CauseRule, CropParams, SegmentLoss } from './types.ts';

export interface CauseInput { segment: SegmentLoss; kind: SegmentKind; heatHours: number | null; expectedTransportH: number | null; withinTolerance: boolean; qualityDropPoints: number }

/** First matching rule wins. The database view uses the same order; this is the reference the tests pin down. */
export function classifyCause(i: CauseInput, crop: CropParams): CauseRule {
  if (i.withinTolerance && i.segment.qualityLossRs === 0) return 'within_tolerance';
  if (i.kind === 'waiting' && i.segment.durationH > crop.maxSafeWaitHours && (i.heatHours ?? 0) >= 1) return 'R1_heat_during_waiting';
  if (i.kind === 'waiting' && i.segment.durationH > crop.maxSafeWaitHours) return 'R2_waited_too_long';
  if (i.kind === 'transport' && i.expectedTransportH != null && i.segment.durationH > i.expectedTransportH * 1.25) return 'R3_transport_delay';
  if (i.kind === 'handling_in' && i.qualityDropPoints >= 5) return 'R4_handling_damage';
  return i.segment.totalLossRs > 0 ? 'unexplained' : 'within_tolerance';
}

/** Plain-language text for a rule; the numbers come from the caller, nothing is invented. */
export function explainRule(rule: CauseRule, n: { waitedH?: number; limitH?: number; heatHours?: number; transportH?: number; expectedH?: number; dropPoints?: number }): string {
  switch (rule) {
    case 'R1_heat_during_waiting': return `Waited ${n.waitedH} h (limit ${n.limitH} h) with ${n.heatHours} h above the heat threshold.`;
    case 'R2_waited_too_long': return `Waited ${n.waitedH} h (limit ${n.limitH} h).`;
    case 'R3_transport_delay': return `Transport took ${n.transportH} h (expected ${n.expectedH} h).`;
    case 'R4_handling_damage': return `Visible quality fell ${n.dropPoints} points while handling.`;
    case 'within_tolerance': return 'Difference is within the scale tolerance.';
    default: return 'No rule explains this loss; treat it as unexplained.';
  }
}
export type { CropParams };
