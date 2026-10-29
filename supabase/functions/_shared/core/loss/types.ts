import type { SegmentKind } from '../types.ts';

export interface CropParams {
  pricePerKg: number;
  /** value of a damaged kilo as a share of a good kilo (0 to 1) */
  damagedValueFactor: number;
  heatThresholdC: number;
  maxSafeWaitHours: number;
  /** scale differences below this percentage are noise, not loss */
  unitTolerancePct: number;
}
export interface Reading { weightKg: number; goodPct: number; damagedPct: number; at: string }
export interface SegmentLoss {
  kind: SegmentKind;
  durationH: number;
  weightLossKg: number;
  weightLossRs: number;
  qualityLossRs: number;
  totalLossRs: number;
  valueFrom: number;
  lossPct: number;
  /** the scale read higher at the end: variance, never negative loss */
  measurementVariance: boolean;
}
export type CauseRule = 'R1_heat_during_waiting' | 'R2_waited_too_long' | 'R3_transport_delay' | 'R4_handling_damage' | 'within_tolerance' | 'unexplained';
