import { describe, expect, it } from 'vitest';
import { classifyCause, evaluateWaiting, segmentLoss, segmentKind, withinTolerance, type CropParams, type Reading } from '../index.ts';

const crop: CropParams = { pricePerKg: 20, damagedValueFactor: 0.5, heatThresholdC: 30, maxSafeWaitHours: 3, unitTolerancePct: 1 };
const r = (weightKg: number, goodPct: number, damagedPct: number, at: string): Reading => ({ weightKg, goodPct, damagedPct, at });

describe('segment loss, hand-calculated', () => {
  // 248 kg at 90/8 -> q = 0.94 ; 240 kg at 65/25 -> q = 0.775 ; 5 h apart
  const prev = r(248, 90, 8, '2026-10-10T03:30:00Z');
  const curr = r(240, 65, 25, '2026-10-10T08:30:00Z');
  const s = segmentLoss(prev, curr, crop, 'waiting');
  it('weight loss: 8 kg x 20 x 0.94 = 150.40', () => expect(s.weightLossRs).toBe(150.4));
  it('quality loss: (0.94 - 0.775) x 240 x 20 = 792.00', () => expect(s.qualityLossRs).toBe(792));
  it('total 942.40 over 5 h', () => { expect(s.totalLossRs).toBe(942.4); expect(s.durationH).toBe(5); });
  it('loss percent is relative to the value entering the step', () => expect(s.lossPct).toBe(20.21));
  it('a weight gain is variance, never negative loss', () => {
    const g = segmentLoss(prev, r(250, 90, 8, '2026-10-10T04:30:00Z'), crop, 'handling_in');
    expect(g.weightLossRs).toBe(0); expect(g.totalLossRs).toBe(0); expect(g.measurementVariance).toBe(true);
  });
  it('tolerance band treats small differences as noise', () => {
    expect(withinTolerance(prev, r(246, 90, 8, prev.at), crop)).toBe(true);
    expect(withinTolerance(prev, curr, crop)).toBe(false);
  });
});

describe('stages and causes', () => {
  it('maps consecutive stages to segment kinds', () => {
    expect(segmentKind('farm_pickup', 'centre_arrival')).toBe('handling_in');
    expect(segmentKind('centre_arrival', 'centre_dispatch')).toBe('waiting');
    expect(segmentKind('centre_dispatch', 'factory_arrival')).toBe('transport');
  });
  const seg = (durationH: number, total = 100) => ({ kind: 'waiting' as const, durationH, weightLossKg: 1, weightLossRs: total, qualityLossRs: 0, totalLossRs: total, valueFrom: 1000, lossPct: 10, measurementVariance: false });
  const base = { kind: 'waiting' as const, heatHours: 0, expectedTransportH: null, withinTolerance: false, qualityDropPoints: 0 };
  it('R1 needs both a long wait and heat', () => expect(classifyCause({ ...base, segment: seg(5), heatHours: 3 }, crop)).toBe('R1_heat_during_waiting'));
  it('R2 is a long wait without heat', () => expect(classifyCause({ ...base, segment: seg(5) }, crop)).toBe('R2_waited_too_long'));
  it('R3 is a slow truck', () => expect(classifyCause({ ...base, kind: 'transport', segment: { ...seg(3), kind: 'transport' }, expectedTransportH: 2 }, crop)).toBe('R3_transport_delay'));
  it('R4 is handling damage', () => expect(classifyCause({ ...base, kind: 'handling_in', segment: { ...seg(1), kind: 'handling_in' }, qualityDropPoints: 8 }, crop)).toBe('R4_handling_damage'));
  it('no rule means unexplained, not a guess', () => expect(classifyCause({ ...base, segment: seg(1) }, crop)).toBe('unexplained'));
});

describe('alerts', () => {
  it('nothing below 75% of the safe wait', () => expect(evaluateWaiting('T-1', 'A', 2, 33, crop)).toBeNull());
  it('warns at 75%', () => expect(evaluateWaiting('T-1', 'A', 2.4, null, crop)).toMatchObject({ severity: 'warn', rule: 'A1_wait_warning' }));
  it('critical with temperature in the message when hot', () => expect(evaluateWaiting('T-1', 'Centre B', 3.4, 35, crop)?.message).toBe('Lot T-1 has waited 3.4 h at 35°C at Centre B. Dispatch now.'));
  it('never invents a temperature', () => expect(evaluateWaiting('T-1', 'B', 3.4, null, crop)?.message).not.toContain('°C'));
});
