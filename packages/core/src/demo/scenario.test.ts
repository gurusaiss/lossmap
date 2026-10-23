import { describe, expect, it } from 'vitest';
import { DEMO_CENTRES, DEMO_ORG_ID, generateDemoScenario, segmentKind, segmentLoss, type CropParams, type Stage } from '../index.ts';

const ids = { orgId: DEMO_ORG_ID, managerId: 'm', agentId: 'a', receiverId: 'r' };
const now = new Date('2026-10-21T08:00:00Z');
const s = generateDemoScenario({ now, ids });
const crop: CropParams = { pricePerKg: 20, damagedValueFactor: 0.5, heatThresholdC: 30, maxSafeWaitHours: 3, unitTolerancePct: 1 };

describe('simulated demo scenario', () => {
  it('is deterministic', () => expect(JSON.stringify(generateDemoScenario({ now, ids }))).toBe(JSON.stringify(s)));
  it('has 114 lots over 14 days, two of them still waiting', () => { expect(s.lots).toHaveLength(114); expect(s.lots.filter((l) => l.status === 'open')).toHaveLength(2); });
  it('is flagged as a simulated demo organisation', () => expect(s.organization).toMatchObject({ is_demo: true }));
  it('qualities always add to 100', () => { for (const c of s.checkpoints) expect((c.quality_good_pct as number) + (c.quality_damaged_pct as number) + (c.quality_rotten_pct as number)).toBeCloseTo(100, 1); });
  it('tells the story: Centre B loses much more of its value than Centre A', () => {
    const loss: Record<string, { l: number; v: number }> = { [DEMO_CENTRES.A]: { l: 0, v: 0 }, [DEMO_CENTRES.B]: { l: 0, v: 0 } };
    for (const lot of s.lots.filter((l) => l.status === 'delivered')) {
      const c = s.checkpoints.filter((x) => x.lot_id === lot.id);
      const centre = c[1]!.centre_id as string;
      const r = (x: typeof c[number]) => ({ weightKg: x.weight_kg as number, goodPct: x.quality_good_pct as number, damagedPct: x.quality_damaged_pct as number, at: x.device_captured_at as string });
      let total = 0;
      for (let i = 1; i < c.length; i++) total += segmentLoss(r(c[i - 1]!), r(c[i]!), crop, segmentKind(c[i - 1]!.stage as Stage, c[i]!.stage as Stage)).totalLossRs;
      loss[centre]!.l += total; loss[centre]!.v += segmentLoss(r(c[0]!), r(c[1]!), crop, 'handling_in').valueFrom;
    }
    const a = loss[DEMO_CENTRES.A]!.l / loss[DEMO_CENTRES.A]!.v, b = loss[DEMO_CENTRES.B]!.l / loss[DEMO_CENTRES.B]!.v;
    expect(b / a).toBeGreaterThan(2);
  });
});
